import express from 'express';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 管理API: 質問一覧取得
router.get('/', authenticateToken, async (req, res) => {
  try {
    const surveyId = req.query.survey_id as string;
    if (!surveyId) {
      return res.status(400).json({ error: 'survey_id is required' });
    }

    const questions = await QuestionModel.findBySurveyId(parseInt(surveyId));
    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const options = await OptionModel.findByQuestionId(question.id);
        return { ...question, options };
      })
    );

    res.json(questionsWithOptions);
  } catch (error: any) {
    console.error('List questions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 質問詳細取得
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const question = await QuestionModel.findById(id);
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const options = await OptionModel.findByQuestionId(question.id);
    res.json({ ...question, options });
  } catch (error: any) {
    console.error('Get question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 質問作成
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { survey_id, question_text, question_type, order, is_required } = req.body;

    if (!survey_id || !question_text || !question_type) {
      return res.status(400).json({ error: 'survey_id, question_text, and question_type are required' });
    }

    const question = await QuestionModel.create({
      survey_id: parseInt(survey_id),
      question_text,
      question_type,
      order,
      is_required,
    });

    res.status(201).json(question);
  } catch (error: any) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 質問更新
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { question_text, question_type, order, is_required } = req.body;

    const question = await QuestionModel.update(id, {
      question_text,
      question_type,
      order,
      is_required,
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (error: any) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 質問削除
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await QuestionModel.delete(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error: any) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 選択肢作成
router.post('/:id/options', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const questionId = parseInt(req.params.id);
    const { option_text, order } = req.body;

    if (!option_text) {
      return res.status(400).json({ error: 'option_text is required' });
    }

    const option = await OptionModel.create({
      question_id: questionId,
      option_text,
      order,
    });

    res.status(201).json(option);
  } catch (error: any) {
    console.error('Create option error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 選択肢更新
router.put('/options/:optionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const optionId = parseInt(req.params.optionId);
    const { option_text, order } = req.body;

    const option = await OptionModel.update(optionId, {
      option_text,
      order,
    });

    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    res.json(option);
  } catch (error: any) {
    console.error('Update option error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理API: 選択肢削除
router.delete('/options/:optionId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const optionId = parseInt(req.params.optionId);
    const deleted = await OptionModel.delete(optionId);

    if (!deleted) {
      return res.status(404).json({ error: 'Option not found' });
    }

    res.json({ message: 'Option deleted successfully' });
  } catch (error: any) {
    console.error('Delete option error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

