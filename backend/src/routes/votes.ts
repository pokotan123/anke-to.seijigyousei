import express from 'express';
import { Server } from 'socket.io';
import { VoteModel } from '../models/Vote';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { redisClient } from '../database/redis';
import { broadcastVoteUpdate } from '../socket';
import { sanitizeInput } from '../middleware/security';

let ioInstance: Server | null = null;

export function setIO(io: Server) {
  ioInstance = io;
}

export function getIO() {
  return ioInstance;
}

const router = express.Router();

// 公開API: 投票送信
router.post('/', async (req, res) => {
  try {
    // 入力値のサニタイゼーション
    const sanitizedBody = sanitizeInput(req.body);
    const { survey_token, question_id, option_id, answer_text } = sanitizedBody;
    const sessionId = req.headers['x-session-id'] as string || req.ip;
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    if (!survey_token || !question_id) {
      return res.status(400).json({ error: 'survey_token and question_id are required' });
    }

    // アンケート取得
    const survey = await SurveyModel.findByToken(survey_token);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // 公開状態チェック
    const isPublished = await SurveyModel.isPublished(survey);
    if (!isPublished) {
      return res.status(403).json({ error: 'Survey is not available' });
    }

    // 質問取得
    const question = await QuestionModel.findById(question_id);
    if (!question || question.survey_id !== survey.id) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // 重複投票チェック
    const hasVoted = await VoteModel.hasVoted(survey.id, question_id, sessionId);
    if (hasVoted) {
      return res.status(400).json({ error: 'You have already voted for this question' });
    }

    // バリデーション
    if (question.question_type === 'text') {
      if (!answer_text) {
        return res.status(400).json({ error: 'answer_text is required for text questions' });
      }
    } else {
      if (!option_id) {
        return res.status(400).json({ error: 'option_id is required for choice questions' });
      }
    }

    // 投票作成
    const vote = await VoteModel.create({
      survey_id: survey.id,
      question_id,
      option_id,
      answer_text,
      session_id: sessionId,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // キャッシュを無効化
    await redisClient.del(`survey:${survey_token}`);
    await redisClient.del(`analytics:survey:${survey.id}`);

    // Socket.ioでリアルタイム通知
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
    console.error('Create vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 投票データ一覧取得
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const surveyId = req.query.survey_id as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const questionId = req.query.question_id as string;
    const search = req.query.search as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    if (!surveyId) {
      return res.status(400).json({ error: 'survey_id is required' });
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

export default router;

