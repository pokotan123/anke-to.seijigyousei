import { pool } from '../database/connection';

export interface Question {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text';
  order: number;
  is_required: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateQuestionInput {
  survey_id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text';
  order?: number;
  is_required?: boolean;
}

export interface UpdateQuestionInput {
  question_text?: string;
  question_type?: 'single_choice' | 'multiple_choice' | 'text';
  order?: number;
  is_required?: boolean;
}

export class QuestionModel {
  static async create(input: CreateQuestionInput): Promise<Question> {
    const query = `
      INSERT INTO questions (survey_id, question_text, question_type, "order", is_required)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      input.survey_id,
      input.question_text,
      input.question_type,
      input.order ?? 0,
      input.is_required ?? false,
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Question | null> {
    const query = 'SELECT * FROM questions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findBySurveyId(surveyId: number): Promise<Question[]> {
    const query = 'SELECT * FROM questions WHERE survey_id = $1 ORDER BY "order" ASC';
    const result = await pool.query(query, [surveyId]);
    return result.rows;
  }

  static async update(id: number, input: UpdateQuestionInput): Promise<Question | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.question_text !== undefined) {
      fields.push(`question_text = $${paramCount++}`);
      values.push(input.question_text);
    }
    if (input.question_type !== undefined) {
      fields.push(`question_type = $${paramCount++}`);
      values.push(input.question_type);
    }
    if (input.order !== undefined) {
      fields.push(`"order" = $${paramCount++}`);
      values.push(input.order);
    }
    if (input.is_required !== undefined) {
      fields.push(`is_required = $${paramCount++}`);
      values.push(input.is_required);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE questions
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM questions WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

