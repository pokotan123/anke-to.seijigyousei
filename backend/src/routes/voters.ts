import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { VoterModel, normalizeEmail } from '../models/Voter';
import { MailOutbox } from '../models/MailOutbox';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { auditLogMiddleware } from '../middleware/auditLog';
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

    // 1対N: 紐付け済み投票アンケート一覧を取得
    const linkedVotingIds = await SurveyModel.findLinkedVotingSurveyIds(survey.id);
    if (linkedVotingIds.length === 0) {
      res.status(400).json({ error: 'このアンケートには投票アンケートが紐付いていません' });
      return;
    }

    // 公開状態チェック
    const isPublished = await SurveyModel.isPublished(survey);
    if (!isPublished) {
      res.status(403).json({ error: 'このアンケートは現在公開されていません' });
      return;
    }

    // 登録開始日チェック
    if (survey.registration_start_date && new Date() < new Date(survey.registration_start_date)) {
      res.status(403).json({ error: '登録受付はまだ開始されていません' });
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

    const email = normalizeEmail(emailAnswer.answer_text);
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

    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // 1対N: 投票アンケートごとに voter_token を発行
    const issued: Array<{ voting_survey_id: number; voter_token: string }> = [];
    const registrationVoterToken = VoterModel.generateVoterToken(); // 登録回答用の代表トークン

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 全回答をvotesテーブルにINSERT（登録survey_id、代表 voter_token）
      const { VoteModel } = await import('../models/Vote');
      const voteInputs = answers.map(answer => ({
        survey_id: survey.id,
        question_id: answer.question_id,
        option_id: answer.option_id,
        answer_text: answer.answer_text,
        session_id: registrationVoterToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        voter_token: registrationVoterToken,
      }));
      await VoteModel.createBatch(client, voteInputs);

      // 各投票アンケートに対して voter を発行（ON CONFLICT で race-free）
      for (const votingId of linkedVotingIds) {
        const votingVoterToken = VoterModel.generateVoterToken();
        const insertRes = await client.query(
          `INSERT INTO voters (survey_id, registration_survey_id, email, voter_token, ip_address, status)
           VALUES ($1, $2, $3, $4, $5, 'registered')
           ON CONFLICT (survey_id, email) DO NOTHING
           RETURNING voter_token`,
          [votingId, survey.id, email, votingVoterToken, ipAddress || null]
        );
        if (insertRes.rows.length === 0) {
          // 既に登録済み = 全体 ROLLBACK して 409
          await client.query('ROLLBACK');
          res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
          return;
        }
        issued.push({ voting_survey_id: votingId, voter_token: insertRes.rows[0].voter_token });
      }

      // mail_outbox に登録完了メールを enqueue（冪等性キー: regconf:{regId}:{emailHash}）
      const emailHash = MailOutbox.hashEmail(email);
      await MailOutbox.enqueue(client, {
        idempotency_key: `regconf:${survey.id}:${emailHash}`,
        mail_type: 'registration_confirmation',
        to_email: email,
        payload: {
          registration_survey_id: survey.id,
          registration_survey_title: survey.title,
          custom_body: survey.registration_mail_body || null,
          links: issued, // [{voting_survey_id, voter_token}]
        },
      });

      // auto_send_vote_link=true の場合、紐付いた投票アンケートごとに投票リンクメールも enqueue
      // （登録完了メールとは独立して2通目以降が届く）
      if (survey.auto_send_vote_link) {
        for (const item of issued) {
          const votingSurvey = await SurveyModel.findById(item.voting_survey_id);
          if (!votingSurvey) continue;
          await MailOutbox.enqueue(client, {
            idempotency_key: `vote_link:${item.voting_survey_id}:${emailHash}`,
            mail_type: 'vote_link_auto',
            to_email: email,
            payload: {
              voting_survey_id: item.voting_survey_id,
              voter_token: item.voter_token,
              survey_title: votingSurvey.title,
              survey_description: votingSurvey.description || null,
              end_date: votingSurvey.end_date,
              custom_body: votingSurvey.vote_mail_body || null,
            },
          });
        }
      }

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    // 同期 fire-and-forget で送信（outbox の状態遷移は MailService 側で更新）
    MailService.processOutboxRegistrationConfirmation(email, survey).catch((err) => {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Registration confirmation email failed for ${email}:`, errMsg);
    });

    // auto_send_vote_link=true なら投票リンクメールも fire-and-forget で送信
    if (survey.auto_send_vote_link) {
      const emailHashForAuto = MailOutbox.hashEmail(email);
      for (const item of issued) {
        MailService.processOutboxVoteLinkAuto(email, emailHashForAuto, item.voting_survey_id)
          .catch((err) => {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`Auto vote link email failed for ${email} (survey ${item.voting_survey_id}):`, errMsg);
          });
      }
    }

    res.status(201).json({
      message: '登録が完了しました。投票リンクは後ほどメールでお届けします。',
      voting_count: issued.length,
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
router.get('/', authenticateToken, auditLogMiddleware, async (req: AuthRequest, res): Promise<void> => {
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
router.post('/send-links', authenticateToken, auditLogMiddleware, async (req: AuthRequest, res): Promise<void> => {
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
router.post('/remind', authenticateToken, auditLogMiddleware, async (req: AuthRequest, res): Promise<void> => {
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
