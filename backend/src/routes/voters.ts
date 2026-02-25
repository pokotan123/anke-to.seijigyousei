import express from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { VoterModel } from '../models/Voter';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { MailService } from '../services/mail';

const router = express.Router();

// レート制限: メール登録用（1IPあたり15分で5回）
const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '登録回数の上限に達しました。しばらくしてから再度お試しください。' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Zodスキーマ
const registerSchema = z.object({
  survey_token: z.string().min(1),
  email: z.string().email('有効なメールアドレスを入力してください'),
  registration_data: z.record(z.string(), z.string()).optional(),
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
// Task 04: POST /register - 投票者メール登録
// ============================================
router.post('/register', registerRateLimit, async (req, res): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { survey_token, email } = parsed.data;

    // アンケート取得
    const survey = await SurveyModel.findByToken(survey_token);
    if (!survey) {
      res.status(404).json({ error: 'アンケートが見つかりません' });
      return;
    }

    // require_registration チェック
    if (!survey.require_registration) {
      res.status(403).json({ error: 'このアンケートはメール登録が必要ありません' });
      return;
    }

    // 公開状態チェック
    if (survey.status !== 'published') {
      res.status(403).json({ error: 'このアンケートは現在公開されていません' });
      return;
    }

    // 登録締め切りチェック
    const deadline = survey.registration_deadline;
    if (deadline && new Date() > new Date(deadline)) {
      res.status(403).json({ error: '登録受付は終了しました' });
      return;
    }

    // カスタム登録項目のバリデーション
    const registrationFields = (survey.registration_fields || []) as Array<{ name: string; required: boolean }>;
    const requiredFields = registrationFields.filter((f) => f.required);
    const regData: Record<string, string> = parsed.data.registration_data || {};

    for (const field of requiredFields) {
      if (!regData[field.name] || regData[field.name].trim() === '') {
        res.status(400).json({ error: `${field.name}は必須です` });
        return;
      }
    }

    // 重複チェック
    const existing = await VoterModel.findByEmail(survey.id, email);
    if (existing) {
      res.status(409).json({ error: 'このメールアドレスは既に登録されています' });
      return;
    }

    // 登録
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    await VoterModel.create({
      survey_id: survey.id,
      email,
      ip_address: ipAddress,
      registration_data: regData,
    });

    res.status(201).json({
      message: '登録が完了しました。投票リンクは後日メールでお届けします。',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

// ============================================
// Task 05: GET /verify/:voter_token - トークン検証
// ============================================
router.get('/verify/:voter_token', async (req, res): Promise<void> => {
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
      },
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        end_date: survey.end_date,
        registration_fields: survey.registration_fields || [],
        questions: questionsWithOptions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
