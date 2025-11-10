import express from 'express';
import { VoteModel } from '../models/Vote';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { redisClient } from '../database/redis';

const router = express.Router();

// 管理API: リアルタイム集計データ取得
router.get('/realtime', authenticateToken, async (req, res) => {
  try {
    const surveyId = req.query.survey_id as string;
    if (!surveyId) {
      return res.status(400).json({ error: 'survey_id is required' });
    }

    // キャッシュチェック
    const cacheKey = `analytics:survey:${surveyId}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const survey = await SurveyModel.findById(parseInt(surveyId));
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const questions = await QuestionModel.findBySurveyId(survey.id);
    const aggregates = await Promise.all(
      questions.map(async (question) => {
        const aggregate = await VoteModel.getAggregateByQuestion(question.id);
        return {
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          aggregates: aggregate,
        };
      })
    );

    const totalVotes = await VoteModel.getTotalCount(survey.id);
    const timeSeries = await VoteModel.getTimeSeries(survey.id);

    const result = {
      survey_id: survey.id,
      survey_title: survey.title,
      total_votes: totalVotes,
      questions: aggregates,
      time_series: timeSeries,
      updated_at: new Date(),
    };

    // キャッシュに保存（30秒）
    await redisClient.setEx(cacheKey, 30, JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 集計データ取得（期間指定）
router.get('/aggregate', authenticateToken, async (req, res) => {
  try {
    const surveyId = req.query.survey_id as string;
    const questionId = req.query.question_id as string;
    const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
    const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

    if (!surveyId) {
      return res.status(400).json({ error: 'survey_id is required' });
    }

    if (questionId) {
      // 特定質問の集計
      const aggregate = await VoteModel.getAggregateByQuestion(parseInt(questionId));
      res.json({
        question_id: parseInt(questionId),
        aggregates: aggregate,
      });
    } else {
      // アンケート全体の集計
      const questions = await QuestionModel.findBySurveyId(parseInt(surveyId));
      const aggregates = await Promise.all(
        questions.map(async (question) => {
          const aggregate = await VoteModel.getAggregateByQuestion(question.id);
          return {
            question_id: question.id,
            question_text: question.question_text,
            aggregates: aggregate,
          };
        })
      );

      const timeSeries = await VoteModel.getTimeSeries(parseInt(surveyId), startDate, endDate);

      res.json({
        survey_id: parseInt(surveyId),
        questions: aggregates,
        time_series: timeSeries,
      });
    }
  } catch (error: any) {
    console.error('Get aggregate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: クロス集計データ取得
router.get('/crosstab', authenticateToken, async (req, res) => {
  try {
    const questionId1 = req.query.question_id1 as string;
    const questionId2 = req.query.question_id2 as string;

    if (!questionId1 || !questionId2) {
      return res.status(400).json({ error: 'question_id1 and question_id2 are required' });
    }

    const crossTab = await VoteModel.getCrossTabulation(
      parseInt(questionId1),
      parseInt(questionId2)
    );

    res.json({
      question_id1: parseInt(questionId1),
      question_id2: parseInt(questionId2),
      cross_tabulation: crossTab,
    });
  } catch (error: any) {
    console.error('Get crosstab error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: ヒートマップデータ取得
router.get('/heatmap', authenticateToken, async (req, res) => {
  try {
    const surveyId = req.query.survey_id as string;
    const questionId = req.query.question_id as string;

    if (!surveyId || !questionId) {
      return res.status(400).json({ error: 'survey_id and question_id are required' });
    }

    const heatmapData = await VoteModel.getHeatmapData(parseInt(surveyId), parseInt(questionId));

    res.json({
      survey_id: parseInt(surveyId),
      question_id: parseInt(questionId),
      heatmap_data: heatmapData,
    });
  } catch (error: any) {
    console.error('Get heatmap error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

