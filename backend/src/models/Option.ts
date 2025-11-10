import { pool } from '../database/connection';

export interface Option {
  id: number;
  question_id: number;
  option_text: string;
  order: number;
  created_at: Date;
}

export interface CreateOptionInput {
  question_id: number;
  option_text: string;
  order?: number;
}

export interface UpdateOptionInput {
  option_text?: string;
  order?: number;
}

export class OptionModel {
  static async create(input: CreateOptionInput): Promise<Option> {
    const query = `
      INSERT INTO options (question_id, option_text, "order")
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [
      input.question_id,
      input.option_text,
      input.order ?? 0,
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Option | null> {
    const query = 'SELECT * FROM options WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByQuestionId(questionId: number): Promise<Option[]> {
    const query = 'SELECT * FROM options WHERE question_id = $1 ORDER BY "order" ASC';
    const result = await pool.query(query, [questionId]);
    return result.rows;
  }

  static async update(id: number, input: UpdateOptionInput): Promise<Option | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.option_text !== undefined) {
      fields.push(`option_text = $${paramCount++}`);
      values.push(input.option_text);
    }
    if (input.order !== undefined) {
      fields.push(`"order" = $${paramCount++}`);
      values.push(input.order);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const query = `
      UPDATE options
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM options WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

