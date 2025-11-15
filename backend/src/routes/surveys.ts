import express from 'express';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { redisClient } from '../database/redis';

const router = express.Router();

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
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
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
router.get('/:id', authenticateToken, async (req, res) => {
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
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { title, description, status, start_date, end_date } = req.body;

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
      created_by: req.user.id,
    });

    res.status(201).json(survey);
  } catch (error: any) {
    console.error('Create survey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: アンケート更新
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, status, start_date, end_date } = req.body;

    const survey = await SurveyModel.update(id, {
      title,
      description,
      status,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
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
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
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
router.post('/:id/regenerate-token', authenticateToken, requireAdmin, async (req, res) => {
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

export default router;

