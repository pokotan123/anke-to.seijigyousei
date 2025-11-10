import { pool } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

export interface Survey {
  id: number;
  unique_token: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  start_date: Date | null;
  end_date: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: number;
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  start_date?: Date;
  end_date?: Date;
  created_by: number;
}

export interface UpdateSurveyInput {
  title?: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  start_date?: Date;
  end_date?: Date;
}

export class SurveyModel {
  static async create(input: CreateSurveyInput): Promise<Survey> {
    const uniqueToken = this.generateUniqueToken();
    const query = `
      INSERT INTO surveys (unique_token, title, description, status, start_date, end_date, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      uniqueToken,
      input.title,
      input.description || null,
      input.status || 'draft',
      input.start_date || null,
      input.end_date || null,
      input.created_by,
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Survey | null> {
    const query = 'SELECT * FROM surveys WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByToken(token: string): Promise<Survey | null> {
    const query = 'SELECT * FROM surveys WHERE unique_token = $1';
    const result = await pool.query(query, [token]);
    return result.rows[0] || null;
  }

  static async findAll(createdBy?: number): Promise<Survey[]> {
    let query = 'SELECT * FROM surveys';
    const values: any[] = [];
    
    if (createdBy) {
      query += ' WHERE created_by = $1';
      values.push(createdBy);
    }
    
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, values);
    return result.rows;
  }

  static async update(id: number, input: UpdateSurveyInput): Promise<Survey | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(input.description);
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(input.status);
    }
    if (input.start_date !== undefined) {
      fields.push(`start_date = $${paramCount++}`);
      values.push(input.start_date);
    }
    if (input.end_date !== undefined) {
      fields.push(`end_date = $${paramCount++}`);
      values.push(input.end_date);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE surveys
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM surveys WHERE id = $1';
    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  static async regenerateToken(id: number): Promise<Survey | null> {
    const uniqueToken = this.generateUniqueToken();
    const query = `
      UPDATE surveys
      SET unique_token = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [uniqueToken, id]);
    return result.rows[0] || null;
  }

  static async isPublished(survey: Survey): Promise<boolean> {
    if (survey.status !== 'published') {
      return false;
    }
    
    const now = new Date();
    if (survey.start_date && now < survey.start_date) {
      return false;
    }
    if (survey.end_date && now > survey.end_date) {
      return false;
    }
    
    return true;
  }

  private static generateUniqueToken(): string {
    // 8-12文字のランダム文字列を生成
    return uuidv4().replace(/-/g, '').substring(0, 12);
  }
}

