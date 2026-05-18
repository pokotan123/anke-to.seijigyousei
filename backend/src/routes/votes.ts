import express from 'express';
import { z } from 'zod';
import { Server } from 'socket.io';
import { VoteModel } from '../models/Vote';
import { SurveyModel } from '../models/Survey';
import { VoterModel } from '../models/Voter';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { auditLogMiddleware } from '../middleware/auditLog';
import { redisClient } from '../database/redis';
import { pool } from '../database/connection';
import { broadcastVoteUpdate } from '../socket';
import { sanitizeInput } from '../middleware/security';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const answerItemSchema = z.object({
  question_id: z.number().int().positive(),
  option_id: z.number().int().positive().optional(),
  answer_text: z.string().min(1).max(5000).optional(),
});

const batchVoteBodySchema = z.object({
  voter_token: z.string().length(64).regex(/^[a-f0-9]{64}$/, 'Invalid voter token format'),
  answers: z.array(answerItemSchema).min(1),
});

type AnswerItem = z.infer<typeof answerItemSchema>;

let ioInstance: Server | null = null;

export function setIO(io: Server) {
  ioInstance = io;
}

export function getIO() {
  return ioInstance;
}

const router = express.Router();

// 公開API: 投票送信
router.post('/', async (req, res): Promise<void> => {
  try {
    const sanitizedBody = sanitizeInput(req.body);
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    // ------------------------------------------------------------------
    // 匿名シングル投票モード（既存フロー・変更なし）
    // ------------------------------------------------------------------
    const { survey_token, question_id, option_id, answer_text } = sanitizedBody;
    const sessionId = (req.headers['x-session-id'] as string) || req.ip || 'unknown';

    if (!survey_token || !question_id) {
      res.status(400).json({ error: 'survey_token and question_id are required' });
      return;
    }

    const survey = await SurveyModel.findByToken(survey_token);
    if (!survey) {
      res.status(404).json({ error: 'Survey not found' });
      return;
    }

    const isPublished = await SurveyModel.isPublished(survey);
    if (!isPublished) {
      res.status(403).json({ error: 'Survey is not available' });
      return;
    }

    // 匿名投票で require_registration=true のアンケートには投票不可
    if (survey.require_registration) {
      res.status(403).json({ error: 'この投票にはメール認証が必要です' });
      return;
    }

    // 1対N: 投票アンケートが登録アンケートに紐付いている場合、匿名投票を拒否
    // (メール認証経由の voter_token を使った POST /votes/batch のみが正規ルート)
    const registrationParent = await SurveyModel.findRegistrationFor(survey.id);
    if (registrationParent) {
      res.status(403).json({ error: 'この投票には登録アンケート経由のメール認証リンクが必要です' });
      return;
    }

    const question = await QuestionModel.findById(question_id);
    if (!question || question.survey_id !== survey.id) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    const hasVoted = await VoteModel.hasVoted(survey.id, question_id, sessionId || 'unknown');
    if (hasVoted) {
      res.status(400).json({ error: 'You have already voted for this question' });
      return;
    }

    if (question.question_type === 'text') {
      if (!answer_text) {
        res.status(400).json({ error: 'answer_text is required for text questions' });
        return;
      }
    } else {
      if (!option_id) {
        res.status(400).json({ error: 'option_id is required for choice questions' });
        return;
      }
    }

    const vote = await VoteModel.create({
      survey_id: survey.id,
      question_id,
      option_id: option_id || undefined,
      answer_text: answer_text || undefined,
      session_id: sessionId || 'unknown',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (redisClient) {
      await redisClient.del(`survey:${survey_token}`);
      await redisClient.del(`analytics:survey:${survey.id}`);
    }

    if (ioInstance) {
      await broadcastVoteUpdate(ioInstance, survey.id, question_id);
    }

    res.status(201).json({
      message: 'Vote submitted successfully',
      vote: {
        id: vote.id,
        question_id: vote.question_id,
        voted_at: vote.voted_at,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// バッチ投票ハンドラ（メール認証アンケート用）
// ---------------------------------------------------------------------------
async function handleBatchVote(
  rawBody: Record<string, unknown>,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  res: express.Response,
): Promise<void> {
  // 1. Zod バリデーション
  const parseResult = batchVoteBodySchema.safeParse(rawBody);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'リクエスト形式が不正です',
      details: parseResult.error.flatten().fieldErrors,
    });
    return;
  }
  const { voter_token, answers } = parseResult.data;

  // 2. voter_token → voter 取得
  const voter = await VoterModel.findByToken(voter_token);
  if (!voter) {
    res.status(404).json({ error: '無効な投票リンクです' });
    return;
  }

  // 3. 既に投票済みチェック
  if (voter.status === 'voted') {
    res.status(403).json({ error: '既に投票済みです' });
    return;
  }

  // 4. アンケート取得・公開チェック
  const survey = await SurveyModel.findById(voter.survey_id);
  if (!survey) {
    res.status(404).json({ error: 'Survey not found' });
    return;
  }

  const isPublished = await SurveyModel.isPublished(survey);
  if (!isPublished) {
    res.status(403).json({ error: 'Survey is not available' });
    return;
  }

  // 5. answers の各 question_id がこのアンケートに属するか検証
  const surveyQuestions = await QuestionModel.findBySurveyId(survey.id);
  const questionMap = new Map(surveyQuestions.map((q) => [q.id, q]));

  for (const answer of answers) {
    const question = questionMap.get(answer.question_id);
    if (!question) {
      res.status(400).json({
        error: `question_id ${answer.question_id} はこのアンケートに存在しません`,
      });
      return;
    }
    if (question.question_type === 'text') {
      if (!answer.answer_text) {
        res.status(400).json({
          error: `question_id ${answer.question_id} はテキスト回答が必要です`,
        });
        return;
      }
    } else {
      if (!answer.option_id) {
        res.status(400).json({
          error: `question_id ${answer.question_id} は選択肢の指定が必要です`,
        });
        return;
      }
    }
  }

  // option_id が question_id に所属するか検証
  for (const answer of answers) {
    if (answer.option_id) {
      const option = await OptionModel.findById(answer.option_id);
      if (!option || option.question_id !== answer.question_id) {
        res.status(400).json({
          error: `option_id ${answer.option_id} は question_id ${answer.question_id} に属していません`,
        });
        return;
      }
    }
  }

  // 6. 全投票 + voter 更新をひとつのトランザクションで実行
  const sessionId = voter.email; // 認証済み投票者はメールアドレスをセッションIDとして使用
  const voteInputs = answers.map((answer: AnswerItem) => ({
    survey_id: survey.id,
    question_id: answer.question_id,
    option_id: answer.option_id,
    answer_text: answer.answer_text,
    session_id: sessionId,
    ip_address: ipAddress,
    user_agent: userAgent,
    voter_token: voter_token,
  }));

  const client = await pool.connect();
  let insertedVotes;
  try {
    await client.query('BEGIN');

    // SELECT FOR UPDATE で行ロック取得
    const lockResult = await client.query(
      'SELECT * FROM voters WHERE voter_token = $1 FOR UPDATE',
      [voter_token],
    );

    // ロック取得後に再度statusチェック（レースコンディション防止）
    if (lockResult.rows.length === 0 || lockResult.rows[0].status === 'voted') {
      await client.query('ROLLBACK');
      res.status(403).json({ error: '既に投票済みです' });
      return;
    }

    insertedVotes = await VoteModel.createBatch(client, voteInputs);
    await client.query(
      `UPDATE voters SET status = 'voted', voted_at = CURRENT_TIMESTAMP
       WHERE voter_token = $1 AND status IN ('sent', 'registered')`,
      [voter_token],
    );
    await client.query('COMMIT');
  } catch (txError) {
    await client.query('ROLLBACK');
    throw txError;
  } finally {
    client.release();
  }

  // 7. キャッシュ無効化
  if (redisClient) {
    await redisClient.del(`survey:${survey.unique_token}`);
    await redisClient.del(`analytics:survey:${survey.id}`);
  }

  // 8. Socket.io リアルタイム通知（全質問分）
  if (ioInstance) {
    for (const vote of insertedVotes) {
      await broadcastVoteUpdate(ioInstance, survey.id, vote.question_id);
    }
  }

  res.status(201).json({
    message: '投票が完了しました',
    votes: insertedVotes.map((v) => ({
      id: v.id,
      question_id: v.question_id,
      voted_at: v.voted_at,
    })),
  });
}

// バッチ投票エンドポイント（メール認証投票用）
router.post('/batch', async (req, res): Promise<void> => {
  try {
    const sanitizedBody = sanitizeInput(req.body);
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.headers['user-agent'] || undefined;
    await handleBatchVote(sanitizedBody, ipAddress, userAgent, res);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 投票データ一覧取得
router.get('/', authenticateToken, async (req: AuthRequest, res): Promise<void> => {
  try {
    const surveyId = req.query.survey_id as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const questionId = req.query.question_id as string;
    const search = req.query.search as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    if (!surveyId) {
      res.status(400).json({ error: 'survey_id is required' });
      return;
    }

    const votes = await VoteModel.findBySurveyIdWithFilters(
      parseInt(surveyId),
      {
        limit,
        offset,
        questionId: questionId ? parseInt(questionId) : undefined,
        search,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      }
    );
    const total = await VoteModel.getTotalCountWithFilters(parseInt(surveyId), {
      questionId: questionId ? parseInt(questionId) : undefined,
      search,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });

    res.json({
      votes,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('List votes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// 一時管理者API: 指定 survey_id の voters + votes を backup → 削除
// ※ 2026-05-18 ID=5/6 クリーンアップタスク専用、完了後にコード revert 予定
// ---------------------------------------------------------------------------
router.post(
  '/admin/cleanup-by-survey-ids',
  authenticateToken,
  auditLogMiddleware,
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { survey_ids, voters_backup_table, votes_backup_table, dry_run } =
        req.body as {
          survey_ids?: unknown;
          voters_backup_table?: unknown;
          votes_backup_table?: unknown;
          dry_run?: unknown;
        };

      if (
        !Array.isArray(survey_ids) ||
        survey_ids.length === 0 ||
        !survey_ids.every(
          (x) => typeof x === 'number' && Number.isInteger(x) && x > 0,
        )
      ) {
        res.status(400).json({
          error: 'survey_ids must be non-empty array of positive integers',
        });
        return;
      }
      if (
        typeof voters_backup_table !== 'string' ||
        !/^voters_backup_[a-z0-9_]+$/.test(voters_backup_table)
      ) {
        res.status(400).json({
          error: 'voters_backup_table must match /^voters_backup_[a-z0-9_]+$/',
        });
        return;
      }
      if (
        typeof votes_backup_table !== 'string' ||
        !/^votes_backup_[a-z0-9_]+$/.test(votes_backup_table)
      ) {
        res.status(400).json({
          error: 'votes_backup_table must match /^votes_backup_[a-z0-9_]+$/',
        });
        return;
      }
      const isDryRun = dry_run !== false;

      const client = await pool.connect();
      try {
        if (isDryRun) {
          const votersCntRes = await client.query(
            'SELECT COUNT(*)::int AS c FROM voters WHERE survey_id = ANY($1::int[])',
            [survey_ids],
          );
          const votesCntRes = await client.query(
            'SELECT COUNT(*)::int AS c FROM votes WHERE survey_id = ANY($1::int[])',
            [survey_ids],
          );
          const votersSampleRes = await client.query(
            'SELECT id, survey_id, email, status, registration_survey_id, registered_at, voted_at, ip_address FROM voters WHERE survey_id = ANY($1::int[]) ORDER BY id',
            [survey_ids],
          );
          const votesSampleRes = await client.query(
            'SELECT id, survey_id, question_id, option_id, voter_token, session_id, ip_address, voted_at FROM votes WHERE survey_id = ANY($1::int[]) ORDER BY id',
            [survey_ids],
          );
          res.json({
            dry_run: true,
            survey_ids,
            voters_count: votersCntRes.rows[0].c,
            votes_count: votesCntRes.rows[0].c,
            voters_rows: votersSampleRes.rows,
            votes_rows: votesSampleRes.rows,
          });
          return;
        }

        await client.query('BEGIN');

        // 1. backup table 作成（既存なら何もしない）
        await client.query(
          `CREATE TABLE IF NOT EXISTS ${voters_backup_table} (LIKE voters INCLUDING ALL)`,
        );
        await client.query(
          `CREATE TABLE IF NOT EXISTS ${votes_backup_table} (LIKE votes INCLUDING ALL)`,
        );

        // 2. backup INSERT
        const votersBackupRes = await client.query(
          `INSERT INTO ${voters_backup_table} SELECT * FROM voters WHERE survey_id = ANY($1::int[]) RETURNING id`,
          [survey_ids],
        );
        const votesBackupRes = await client.query(
          `INSERT INTO ${votes_backup_table} SELECT * FROM votes WHERE survey_id = ANY($1::int[]) RETURNING id`,
          [survey_ids],
        );

        // 3. 削除前メールリスト取得
        const deletedEmailsRes = await client.query(
          'SELECT email FROM voters WHERE survey_id = ANY($1::int[]) ORDER BY email',
          [survey_ids],
        );

        // 4. DELETE (votes 先, voters 後)
        const votesDelRes = await client.query(
          'DELETE FROM votes WHERE survey_id = ANY($1::int[]) RETURNING id',
          [survey_ids],
        );
        const votersDelRes = await client.query(
          'DELETE FROM voters WHERE survey_id = ANY($1::int[]) RETURNING id',
          [survey_ids],
        );

        // 5. 削除後確認
        const votersRemainRes = await client.query(
          'SELECT COUNT(*)::int AS c FROM voters WHERE survey_id = ANY($1::int[])',
          [survey_ids],
        );
        const votesRemainRes = await client.query(
          'SELECT COUNT(*)::int AS c FROM votes WHERE survey_id = ANY($1::int[])',
          [survey_ids],
        );

        await client.query('COMMIT');

        res.json({
          dry_run: false,
          survey_ids,
          voters_backup_table,
          votes_backup_table,
          voters_backed_up: votersBackupRes.rowCount,
          votes_backed_up: votesBackupRes.rowCount,
          voters_deleted: votersDelRes.rowCount,
          votes_deleted: votesDelRes.rowCount,
          voters_remaining: votersRemainRes.rows[0].c,
          votes_remaining: votesRemainRes.rows[0].c,
          deleted_emails: deletedEmailsRes.rows.map((r) => r.email),
        });
      } catch (txError) {
        await client.query('ROLLBACK').catch(() => {});
        throw txError;
      } finally {
        client.release();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: msg });
    }
  },
);

export default router;

