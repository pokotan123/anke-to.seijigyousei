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
  require_registration: boolean;
  registration_message: string | null;
  registration_start_date: Date | null;
  registration_deadline: Date | null;
  registration_fields: any[] | null;
  vote_mail_body: string | null;
  reminder_mail_body: string | null;
  registration_mail_body: string | null;
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
  require_registration?: boolean;
  registration_message?: string;
  registration_start_date?: Date;
  registration_deadline?: Date;
  registration_fields?: any[];
  vote_mail_body?: string;
  reminder_mail_body?: string;
  registration_mail_body?: string;
}

export interface UpdateSurveyInput {
  title?: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  start_date?: Date | null;
  end_date?: Date | null;
  require_registration?: boolean;
  registration_message?: string;
  registration_start_date?: Date | null;
  registration_deadline?: Date | null;
  registration_fields?: any[];
  vote_mail_body?: string;
  reminder_mail_body?: string;
  registration_mail_body?: string;
}

export class SurveyModel {
  static async create(input: CreateSurveyInput): Promise<Survey> {
    const uniqueToken = this.generateUniqueToken();
    const query = `
      INSERT INTO surveys (unique_token, title, description, status, start_date, end_date, created_by, require_registration, registration_message, registration_start_date, registration_deadline, registration_fields, vote_mail_body, reminder_mail_body, registration_mail_body)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
      input.require_registration || false,
      input.registration_message || null,
      input.registration_start_date || null,
      input.registration_deadline || null,
      input.registration_fields ? JSON.stringify(input.registration_fields) : '[]',
      input.vote_mail_body || null,
      input.reminder_mail_body || null,
      input.registration_mail_body || null,
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
    if (input.require_registration !== undefined) {
      fields.push(`require_registration = $${paramCount++}`);
      values.push(input.require_registration);
    }
    if (input.registration_message !== undefined) {
      fields.push(`registration_message = $${paramCount++}`);
      values.push(input.registration_message);
    }
    if (input.registration_start_date !== undefined) {
      fields.push(`registration_start_date = $${paramCount++}`);
      values.push(input.registration_start_date);
    }
    if (input.registration_deadline !== undefined) {
      fields.push(`registration_deadline = $${paramCount++}`);
      values.push(input.registration_deadline);
    }
    if (input.registration_fields !== undefined) {
      fields.push(`registration_fields = $${paramCount++}`);
      values.push(JSON.stringify(input.registration_fields));
    }
    if (input.vote_mail_body !== undefined) {
      fields.push(`vote_mail_body = $${paramCount++}`);
      values.push(input.vote_mail_body);
    }
    if (input.reminder_mail_body !== undefined) {
      fields.push(`reminder_mail_body = $${paramCount++}`);
      values.push(input.reminder_mail_body);
    }
    if (input.registration_mail_body !== undefined) {
      fields.push(`registration_mail_body = $${paramCount++}`);
      values.push(input.registration_mail_body);
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

  /** 1対N: 紐付け先の投票アンケートIDを列挙（sort_order ASC） */
  static async findLinkedVotingSurveyIds(registrationSurveyId: number): Promise<number[]> {
    const query = `
      SELECT voting_survey_id FROM survey_voting_links
      WHERE registration_survey_id = $1
      ORDER BY sort_order ASC, voting_survey_id ASC
    `;
    const result = await pool.query(query, [registrationSurveyId]);
    return result.rows.map(r => r.voting_survey_id);
  }

  /** 1対N: 紐付け先の投票アンケートをフル取得 */
  static async findLinkedVotingSurveys(registrationSurveyId: number): Promise<Survey[]> {
    const query = `
      SELECT s.* FROM surveys s
      INNER JOIN survey_voting_links l ON l.voting_survey_id = s.id
      WHERE l.registration_survey_id = $1
      ORDER BY l.sort_order ASC, l.voting_survey_id ASC
    `;
    const result = await pool.query(query, [registrationSurveyId]);
    return result.rows;
  }

  /** 1対N: 投票アンケートが「いずれかの登録アンケートに紐付いているか」確認 */
  static async findRegistrationFor(votingSurveyId: number): Promise<Survey | null> {
    const query = `
      SELECT s.* FROM surveys s
      INNER JOIN survey_voting_links l ON l.registration_survey_id = s.id
      WHERE l.voting_survey_id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [votingSurveyId]);
    return result.rows[0] || null;
  }

  /** 1対N: 登録アンケート一覧（require_registration=true） */
  static async findRegistrationSurveys(): Promise<Survey[]> {
    const query = `SELECT * FROM surveys WHERE require_registration = true ORDER BY created_at DESC`;
    const result = await pool.query(query);
    return result.rows;
  }

  /** 一括置換: registration_survey_id の紐付けを voting_survey_ids[] に同期 */
  static async replaceVotingLinks(
    client: any,
    registrationSurveyId: number,
    votingSurveyIds: number[]
  ): Promise<{ added: number[]; removed: number[] }> {
    const existingRes = await client.query(
      `SELECT voting_survey_id FROM survey_voting_links WHERE registration_survey_id = $1`,
      [registrationSurveyId]
    );
    const existing = new Set<number>(existingRes.rows.map((r: any) => r.voting_survey_id));
    const target = new Set<number>(votingSurveyIds);
    const added: number[] = [...target].filter(id => !existing.has(id));
    const removed: number[] = [...existing].filter(id => !target.has(id));

    if (removed.length > 0) {
      await client.query(
        `DELETE FROM survey_voting_links WHERE registration_survey_id = $1 AND voting_survey_id = ANY($2::int[])`,
        [registrationSurveyId, removed]
      );
    }
    for (let i = 0; i < added.length; i++) {
      const vid = added[i];
      await client.query(
        `INSERT INTO survey_voting_links (registration_survey_id, voting_survey_id, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (registration_survey_id, voting_survey_id) DO NOTHING`,
        [registrationSurveyId, vid, i]
      );
    }
    // updated_at touch（楽観ロック用）
    await client.query(
      `UPDATE surveys SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [registrationSurveyId]
    );
    return { added, removed };
  }

  static async isPublished(survey: Survey): Promise<boolean> {
    if (survey.status !== 'published') {
      return false;
    }

    const now = new Date();
    if (survey.start_date && now < new Date(survey.start_date)) {
      return false;
    }
    if (survey.end_date && now > new Date(survey.end_date)) {
      return false;
    }

    return true;
  }

  private static generateUniqueToken(): string {
    // 8-12文字のランダム文字列を生成
    return uuidv4().replace(/-/g, '').substring(0, 12);
  }
}
