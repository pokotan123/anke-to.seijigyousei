import express from 'express';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { redisClient } from '../database/redis';
import { pool } from '../database/connection';

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
    const { title, description, status, start_date, end_date, registration_start_date, linked_voting_survey_id, vote_mail_body, reminder_mail_body, registration_mail_body } = req.body;

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
      linked_voting_survey_id: linked_voting_survey_id || null,
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
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, status, start_date, end_date, registration_start_date, registration_deadline, require_registration, registration_message, registration_fields, linked_voting_survey_id, vote_mail_body, reminder_mail_body, registration_mail_body } = req.body;

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
      linked_voting_survey_id,
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

// 管理API: CSVエクスポート
router.get('/:id/export/csv', authenticateToken, requireAdmin, async (req, res) => {
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

export default router;

