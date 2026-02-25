import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { VoterModel } from '../models/Voter';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { MailService } from '../services/mail';
import { pool } from '../database/connection';

const router = express.Router();

// レート制限: メール登録用（1IPあたり15分で5回）
const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '登録回数の上限に達しました。しばらくしてから再度お試しください。' },
  standardHeaders: true,
  legacyHeaders: false,
});

// レート制限: トークン検証用（1IPあたり15分で30回）
const verifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'リクエスト回数の上限に達しました。しばらくしてから再度お試しください。' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Zodスキーマ - 登録アンケート回答用
const registerSurveySchema = z.object({
  survey_token: z.string().min(1),
  answers: z.array(z.object({
    question_id: z.number().int().positive(),
    option_id: z.number().int().positive().optional(),
    answer_text: z.string().min(1).max(5000).optional(),
  })).min(1),
});

// ヘルパー: メールアドレスマスク
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const masked = local.length <= 2
    ? '***'
    : `${local.substring(0, 2)}***`;
  return `${masked}@${domain}`;
}

// ============================================
// Task 04: POST /register - 登録アンケート回答 + 投票者登録
// ============================================
router.post('/register', registerRateLimit, async (req, res): Promise<void> => {
  try {
    const parsed = registerSurveySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { survey_token, answers } = parsed.data;

    // 登録用アンケート取得
    const survey = await SurveyModel.findByToken(survey_token);
    if (!survey) {
      res.status(404).json({ error: 'アンケートが見つかりません' });
      return;
    }

    // linked_voting_survey_id の確認（登録用アンケートであること）
    if (!survey.linked_voting_survey_id) {
      res.status(400).json({ error: 'このアンケートは登録用アンケートではありません' });
      return;
    }

    // 公開状態チェック
    const isPublished = await SurveyModel.isPublished(survey);
    if (!isPublished) {
      res.status(403).json({ error: 'このアンケートは現在公開されていません' });
      return;
    }

    // 登録締め切りチェック
    if (survey.registration_deadline && new Date() > new Date(survey.registration_deadline)) {
      res.status(403).json({ error: '登録受付は終了しました' });
      return;
    }

    // 質問を取得してemail質問を特定
    const questions = await QuestionModel.findBySurveyId(survey.id);
    const emailQuestion = questions.find(q => q.question_type === 'email');
    if (!emailQuestion) {
      res.status(400).json({ error: 'このアンケートにはメール質問が設定されていません' });
      return;
    }

    // 回答からメールアドレスを抽出
    const emailAnswer = answers.find(a => a.question_id === emailQuestion.id);
    if (!emailAnswer || !emailAnswer.answer_text) {
      res.status(400).json({ error: 'メールアドレスの入力が必要です' });
      return;
    }

    const email = emailAnswer.answer_text.trim().toLowerCase();
    // メールバリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: '有効なメールアドレスを入力してください' });
      return;
    }

    // 各回答がこのアンケートの質問に属するか検証
    const questionMap = new Map(questions.map(q => [q.id, q]));
    for (const answer of answers) {
      if (!questionMap.has(answer.question_id)) {
        res.status(400).json({ error: `question_id ${answer.question_id} はこのアンケートに存在しません` });
        return;
      }
    }

    // 重複チェック（投票用survey側のvotersテーブル）
    const existingVoter = await VoterModel.findByEmail(survey.linked_voting_survey_id, email);
    if (existingVoter) {
      res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
      return;
    }

    // トランザクションで回答保存 + voter作成
    const voterToken = VoterModel.generateVoterToken();
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 全回答をvotesテーブルにINSERT（登録survey_id）
      const { VoteModel } = await import('../models/Vote');
      const voteInputs = answers.map(answer => ({
        survey_id: survey.id,
        question_id: answer.question_id,
        option_id: answer.option_id,
        answer_text: answer.answer_text,
        session_id: voterToken, // voter_tokenをセッションID代わりに使用
        ip_address: ipAddress,
        user_agent: userAgent,
        voter_token: voterToken,
      }));
      await VoteModel.createBatch(client, voteInputs);

      // votersテーブルにINSERT（投票用survey_id側）
      await client.query(
        `INSERT INTO voters (survey_id, email, voter_token, ip_address, status)
         VALUES ($1, $2, $3, $4, 'registered')`,
        [survey.linked_voting_survey_id, email, voterToken, ipAddress || null]
      );

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    // 登録完了メール送信（トランザクション外で非同期実行）
    const votingSurvey = await SurveyModel.findById(survey.linked_voting_survey_id);
    const votingSurveyTitle = votingSurvey ? votingSurvey.title : '投票アンケート';

    MailService.sendRegistrationConfirmation({
      email,
      surveyTitle: survey.title,
      votingSurveyTitle,
      customBody: survey.registration_mail_body,
    }).catch((err) => {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Registration confirmation email failed for ${email}:`, errMsg);
    });

    res.status(201).json({
      message: '登録が完了しました。投票リンクは後日メールでお届けします。',
    });
  } catch (error: unknown) {
    res.status(500).json({ error: '登録処理中にエラーが発生しました' });
  }
});

// ============================================
// Task 05: GET /verify/:voter_token - トークン検証
// ============================================
router.get('/verify/:voter_token', verifyRateLimit, async (req, res): Promise<void> => {
  try {
    const { voter_token } = req.params;

    // voter取得
    const voter = await VoterModel.findByToken(voter_token);
    if (!voter) {
      res.status(404).json({ error: '無効なリンクです' });
      return;
    }

    // 投票済みチェック
    if (voter.status === 'voted') {
      res.status(403).json({ error: '既に投票済みです' });
      return;
    }

    // アンケート取得
    const survey = await SurveyModel.findById(voter.survey_id);
    if (!survey) {
      res.status(404).json({ error: 'アンケートが見つかりません' });
      return;
    }

    // 公開・期間チェック
    const isPublished = await SurveyModel.isPublished(survey);
    if (!isPublished) {
      res.status(403).json({ error: '投票期間外です' });
      return;
    }

    // 質問・選択肢を取得
    const questions = await QuestionModel.findBySurveyId(survey.id);
    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const options = await OptionModel.findByQuestionId(question.id);
        return { ...question, options };
      })
    );

    // メールアドレスをマスク
    const maskedEmail = maskEmail(voter.email);

    res.json({
      voter: {
        email: maskedEmail,
        status: voter.status,
        voter_token: voter.voter_token,
      },
      survey: {
        id: survey.id,
        token: survey.unique_token,
        title: survey.title,
        description: survey.description,
        end_date: survey.end_date,
        questions: questionsWithOptions,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Task 07: GET / - 投票者一覧（管理者用）
// ============================================
router.get('/', authenticateToken, async (req: AuthRequest, res): Promise<void> => {
  try {
    const surveyId = req.query.survey_id as string;
    if (!surveyId) {
      res.status(400).json({ error: 'survey_id is required' });
      return;
    }

    const voters = await VoterModel.findBySurveyId(parseInt(surveyId));
    const summary = await VoterModel.getSummary(parseInt(surveyId));

    res.json({ voters, summary });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Task 08: POST /send-links - 投票リンク一括送信
// ============================================
router.post('/send-links', authenticateToken, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { survey_id } = req.body;
    if (!survey_id) {
      res.status(400).json({ error: 'survey_id is required' });
      return;
    }

    const survey = await SurveyModel.findById(survey_id);
    if (!survey) {
      res.status(404).json({ error: 'アンケートが見つかりません' });
      return;
    }

    // status='registered' の voters を取得
    const voters = await VoterModel.findBySurveyIdAndStatus(survey_id, 'registered');

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const voter of voters) {
      const result = await MailService.sendVoteLink({
        email: voter.email,
        voterToken: voter.voter_token,
        surveyTitle: survey.title,
        surveyDescription: survey.description,
        endDate: survey.end_date,
        customBody: survey.vote_mail_body,
      });

      if (result.success) {
        await VoterModel.markAsSent(voter.id);
        sent++;
      } else {
        failed++;
        errors.push(`${voter.email}: ${result.error}`);
      }
    }

    // 既に送信済みのカウント
    const alreadySent = await VoterModel.findBySurveyIdAndStatus(survey_id, 'sent');

    res.json({
      sent,
      failed,
      already_sent: alreadySent.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Task 08: POST /remind - リマインドメール送信
// ============================================
router.post('/remind', authenticateToken, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { survey_id } = req.body;
    if (!survey_id) {
      res.status(400).json({ error: 'survey_id is required' });
      return;
    }

    const survey = await SurveyModel.findById(survey_id);
    if (!survey) {
      res.status(404).json({ error: 'アンケートが見つかりません' });
      return;
    }

    // status='sent' の voters を取得（未投票者）
    const voters = await VoterModel.findBySurveyIdAndStatus(survey_id, 'sent');

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // 投票済みカウント
    const votedVoters = await VoterModel.findBySurveyIdAndStatus(survey_id, 'voted');

    for (const voter of voters) {
      const result = await MailService.sendReminder({
        email: voter.email,
        voterToken: voter.voter_token,
        surveyTitle: survey.title,
        endDate: survey.end_date,
        customBody: survey.reminder_mail_body,
      });

      if (result.success) {
        await VoterModel.updateReminderSent(voter.id);
        sent++;
      } else {
        failed++;
        errors.push(`${voter.email}: ${result.error}`);
      }
    }

    res.json({
      sent,
      failed,
      already_voted: votedVoters.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
