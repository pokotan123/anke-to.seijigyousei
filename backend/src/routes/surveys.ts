import express from 'express';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { VoterModel, normalizeEmail } from '../models/Voter';
import { MailOutbox } from '../models/MailOutbox';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { auditLogMiddleware } from '../middleware/auditLog';
import { redisClient } from '../database/redis';
import { pool } from '../database/connection';

const router = express.Router();

/** 監査ログ出力 */
function auditLog(req: AuthRequest, action: string, targetId: number, extras: Record<string, any>) {
  const entry = {
    audit: true,
    timestamp: new Date().toISOString(),
    operator_id: req.user?.id || null,
    operator_username: req.user?.username || null,
    action,
    target_survey_id: targetId,
    request_id: (req.headers['x-request-id'] as string) || null,
    ip_address: req.ip || null,
    result: 'success',
    ...extras,
  };
  console.log(JSON.stringify(entry));
}

// 公開API: トークンでアンケート取得
router.get('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // キャッシュチェック
    const cacheKey = `survey:${token}`;
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    }

    const survey = await SurveyModel.findByToken(token);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const isPublished = await SurveyModel.isPublished(survey);
    if (!isPublished) {
      return res.status(403).json({ error: 'Survey is not available' });
    }

    // 質問と選択肢を取得
    const questions = await QuestionModel.findBySurveyId(survey.id);
    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const options = await OptionModel.findByQuestionId(question.id);
        return { ...question, options };
      })
    );

    const result = {
      ...survey,
      questions: questionsWithOptions,
    };

    // キャッシュに保存（1時間）
    if (redisClient) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(result));
    }

    res.json(result);
  } catch (error: any) {
    console.error('Get survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: アンケート一覧取得
router.get('/', authenticateToken, auditLogMiddleware, async (req: AuthRequest, res) => {
  try {
    const createdBy = req.user?.role === 'admin' ? undefined : req.user?.id;
    const surveys = await SurveyModel.findAll(createdBy);
    res.json(surveys);
  } catch (error: any) {
    console.error('List surveys error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: アンケート詳細取得
router.get('/:id', authenticateToken, auditLogMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const survey = await SurveyModel.findById(id);
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const questions = await QuestionModel.findBySurveyId(survey.id);
    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const options = await OptionModel.findByQuestionId(question.id);
        return { ...question, options };
      })
    );

    res.json({
      ...survey,
      questions: questionsWithOptions,
    });
  } catch (error: any) {
    console.error('Get survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: アンケート作成
router.post('/', authenticateToken, auditLogMiddleware, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, description, status, start_date, end_date, registration_start_date, vote_mail_body, reminder_mail_body, registration_mail_body, require_registration } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const survey = await SurveyModel.create({
      title,
      description,
      status,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      registration_start_date: registration_start_date ? new Date(registration_start_date) : undefined,
      created_by: req.user.id,
      require_registration: require_registration === true,
      vote_mail_body: vote_mail_body || null,
      reminder_mail_body: reminder_mail_body || null,
      registration_mail_body: registration_mail_body || null,
    });

    res.status(201).json(survey);
  } catch (error: any) {
    console.error('Create survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: アンケート更新
router.put('/:id', authenticateToken, auditLogMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, status, start_date, end_date, registration_start_date, registration_deadline, require_registration, registration_message, registration_fields, vote_mail_body, reminder_mail_body, registration_mail_body } = req.body;

    const survey = await SurveyModel.update(id, {
      title,
      description,
      status,
      start_date: 'start_date' in req.body ? (start_date ? new Date(start_date) : null) : undefined,
      end_date: 'end_date' in req.body ? (end_date ? new Date(end_date) : null) : undefined,
      registration_start_date: 'registration_start_date' in req.body ? (registration_start_date ? new Date(registration_start_date) : null) : undefined,
      registration_deadline: 'registration_deadline' in req.body ? (registration_deadline ? new Date(registration_deadline) : null) : undefined,
      require_registration,
      registration_message,
      registration_fields,
      vote_mail_body,
      reminder_mail_body,
      registration_mail_body,
    });

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // キャッシュを無効化
    if (redisClient) {
      await redisClient.del(`survey:${survey.unique_token}`);
    }

    res.json(survey);
  } catch (error: any) {
    console.error('Update survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: アンケート削除
router.delete('/:id', authenticateToken, auditLogMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const survey = await SurveyModel.findById(id);
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    await SurveyModel.delete(id);

    // キャッシュを無効化
    if (redisClient) {
      await redisClient.del(`survey:${survey.unique_token}`);
    }

    res.json({ message: 'Survey deleted successfully' });
  } catch (error: any) {
    console.error('Delete survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: URLトークン再発行
router.post('/:id/regenerate-token', authenticateToken, auditLogMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const survey = await SurveyModel.findById(id);
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // 旧トークンのキャッシュを無効化
    if (redisClient) {
      await redisClient.del(`survey:${survey.unique_token}`);
    }

    const updatedSurvey = await SurveyModel.regenerateToken(id);
    
    if (!updatedSurvey) {
      return res.status(500).json({ error: 'Failed to regenerate token' });
    }

    res.json(updatedSurvey);
  } catch (error: any) {
    console.error('Regenerate token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: CSVエクスポート
router.get('/:id/export/csv', authenticateToken, auditLogMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const survey = await SurveyModel.findById(id);
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // 投票データを取得（質問テキスト、選択肢テキストを含む）
    const query = `
      SELECT 
        v.id,
        v.survey_id,
        v.question_id,
        q.question_text,
        q.question_type,
        v.option_id,
        o.option_text,
        v.answer_text,
        v.session_id,
        v.ip_address,
        v.voted_at
      FROM votes v
      LEFT JOIN questions q ON v.question_id = q.id
      LEFT JOIN options o ON v.option_id = o.id
      WHERE v.survey_id = $1
      ORDER BY v.voted_at DESC
    `;
    const result = await pool.query(query, [id]);
    const votes = result.rows;

    // CSV形式に変換
    const headers = [
      'ID',
      '質問ID',
      '質問テキスト',
      '質問タイプ',
      '選択肢ID',
      '選択肢テキスト',
      '回答テキスト',
      'セッションID',
      'IPアドレス',
      '投票日時'
    ];

    const rows = votes.map((vote) => [
      vote.id,
      vote.question_id,
      vote.question_text || '',
      vote.question_type || '',
      vote.option_id || '',
      vote.option_text || '',
      vote.answer_text || '',
      vote.session_id,
      vote.ip_address || '',
      new Date(vote.voted_at).toLocaleString('ja-JP')
    ]);

    // CSV文字列を生成
    const escapeCSV = (value: any): string => {
      const str = String(value || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // BOM付きUTF-8で返す（Excelで正しく開けるように）
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(survey.title)}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(bom + csvContent);
  } catch (error: any) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// 1対N: voting-links endpoints
// ============================================

/** GET /surveys/:id/voting-links - 紐付け済み投票アンケートID配列 + 投票アンケート詳細 */
router.get('/:id/voting-links', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const survey = await SurveyModel.findById(id);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const linkedIds = await SurveyModel.findLinkedVotingSurveyIds(id);
    const linked = await SurveyModel.findLinkedVotingSurveys(id);

    res.json({
      registration_survey: { id: survey.id, title: survey.title, updated_at: survey.updated_at },
      voting_survey_ids: linkedIds,
      voting_surveys: linked,
    });
  } catch (error: any) {
    console.error('List voting-links error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /surveys/:id/voting-links - 紐付けを一括置換（楽観ロック） */
router.put('/:id/voting-links', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { voting_survey_ids, expected_updated_at } = req.body;

    if (!Array.isArray(voting_survey_ids)) {
      return res.status(400).json({ error: 'voting_survey_ids must be an array' });
    }

    const survey = await SurveyModel.findById(id);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    // 楽観ロック
    if (expected_updated_at) {
      const expected = new Date(expected_updated_at).getTime();
      const actual = new Date(survey.updated_at).getTime();
      if (Math.abs(expected - actual) > 1000) {
        return res.status(409).json({ error: '他のユーザーが先に変更しました。再読込してください。' });
      }
    }

    // 型検証: 登録 ↔ 投票 の組合せ
    if (!survey.require_registration) {
      return res.status(400).json({ error: 'This survey is not a registration survey' });
    }
    for (const vid of voting_survey_ids) {
      if (vid === id) return res.status(400).json({ error: '自己リンクは禁止されています' });
      const target = await SurveyModel.findById(vid);
      if (!target) return res.status(400).json({ error: `voting_survey_id=${vid} not found` });
      if (target.require_registration) {
        return res.status(400).json({ error: `voting_survey_id=${vid} は登録アンケートのため紐付けできません` });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const diff = await SurveyModel.replaceVotingLinks(client, id, voting_survey_ids);
      await client.query('COMMIT');
      auditLog(req, 'voting_links.update', id, {
        diff: { added: diff.added, removed: diff.removed },
        count: { before: voting_survey_ids.length - diff.added.length + diff.removed.length, after: voting_survey_ids.length },
      });
      res.json({ voting_survey_ids, diff });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Update voting-links error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /surveys/:id/voting-links/:voting_id/notify - 後付け追加した投票アンケートを既存登録者に通知 */
router.post('/:id/voting-links/:voting_id/notify', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const votingId = parseInt(req.params.voting_id);

    const survey = await SurveyModel.findById(id);
    if (!survey) return res.status(404).json({ error: 'Registration survey not found' });
    const votingSurvey = await SurveyModel.findById(votingId);
    if (!votingSurvey) return res.status(404).json({ error: 'Voting survey not found' });

    // この紐付けが存在するか確認
    const linkedIds = await SurveyModel.findLinkedVotingSurveyIds(id);
    if (!linkedIds.includes(votingId)) {
      return res.status(400).json({ error: 'この投票アンケートは紐付けられていません' });
    }

    // 登録元アンケートで登録済みの voter（email でユニーク）
    const existingVoters = await VoterModel.findByRegistrationSurveyId(id);
    if (existingVoters.length === 0) {
      return res.json({ enqueued: 0, skipped: 0, message: '対象登録者がいません' });
    }

    // 対象集合ハッシュ（冪等性キー用）
    const targetSetHash = MailOutbox.hashTargetSet(existingVoters.map(v => v.id));

    let enqueued = 0;
    let skipped = 0;
    const issued: Array<{ email: string; voter_token: string }> = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const v of existingVoters) {
        // 既に同じ voting_survey_id への voter row があるか確認
        const newToken = VoterModel.generateVoterToken();
        const insertRes = await client.query(
          `INSERT INTO voters (survey_id, registration_survey_id, email, voter_token, ip_address, status)
           VALUES ($1, $2, $3, $4, $5, 'registered')
           ON CONFLICT (survey_id, email) DO NOTHING
           RETURNING voter_token`,
          [votingId, id, v.email, newToken, v.ip_address]
        );
        if (insertRes.rows.length === 0) {
          skipped++;
          continue;
        }
        const tokenIssued = insertRes.rows[0].voter_token;
        issued.push({ email: v.email, voter_token: tokenIssued });

        const emailHash = MailOutbox.hashEmail(v.email);
        const result = await MailOutbox.enqueue(client, {
          idempotency_key: `notify:${votingId}:${emailHash}:${targetSetHash}`,
          mail_type: 'new_voting_notification',
          to_email: v.email,
          payload: {
            registration_survey_id: id,
            registration_survey_title: survey.title,
            voting_survey_id: votingId,
            voting_survey_title: votingSurvey.title,
            voter_token: tokenIssued,
          },
        });
        if (result) enqueued++;
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    auditLog(req, 'voting_links.notify', id, {
      voting_survey_id: votingId,
      target_count: existingVoters.length,
      enqueued,
      skipped,
    });

    // fire-and-forget でメール送信開始
    const { MailService } = await import('../services/mail');
    MailService.processOutboxNewVotingNotifications(votingId, issued).catch((err) => {
      console.error('Notify mail processing failed:', err);
    });

    res.json({ enqueued, skipped, target_count: existingVoters.length });
  } catch (error: any) {
    console.error('Notify voting-link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

