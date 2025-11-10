import { pool } from '../database/connection';

export interface Vote {
  id: number;
  survey_id: number;
  question_id: number;
  option_id: number | null;
  answer_text: string | null;
  session_id: string;
  ip_address: string | null;
  user_agent: string | null;
  voted_at: Date;
  created_at: Date;
}

export interface CreateVoteInput {
  survey_id: number;
  question_id: number;
  option_id?: number;
  answer_text?: string;
  session_id: string;
  ip_address?: string;
  user_agent?: string;
}

export interface VoteAggregate {
  option_id: number | null;
  option_text: string | null;
  count: number;
  percentage: number;
}

export class VoteModel {
  static async create(input: CreateVoteInput): Promise<Vote> {
    const query = `
      INSERT INTO votes (survey_id, question_id, option_id, answer_text, session_id, ip_address, user_agent, voted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const values = [
      input.survey_id,
      input.question_id,
      input.option_id || null,
      input.answer_text || null,
      input.session_id,
      input.ip_address || null,
      input.user_agent || null,
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findById(id: number): Promise<Vote | null> {
    const query = 'SELECT * FROM votes WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findBySurveyId(surveyId: number, limit?: number, offset?: number): Promise<Vote[]> {
    let query = 'SELECT * FROM votes WHERE survey_id = $1 ORDER BY voted_at DESC';
    const values: any[] = [surveyId];
    
    if (limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(limit);
    }
    if (offset) {
      query += ` OFFSET $${values.length + 1}`;
      values.push(offset);
    }
    
    const result = await pool.query(query, values);
    return result.rows;
  }

  static async findBySurveyIdWithFilters(
    surveyId: number,
    filters: {
      limit?: number;
      offset?: number;
      questionId?: number;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<Vote[]> {
    let query = 'SELECT * FROM votes WHERE survey_id = $1';
    const values: any[] = [surveyId];
    let paramCount = 2;

    if (filters.questionId) {
      query += ` AND question_id = $${paramCount++}`;
      values.push(filters.questionId);
    }

    if (filters.search) {
      query += ` AND (
        answer_text ILIKE $${paramCount} OR
        session_id ILIKE $${paramCount} OR
        ip_address ILIKE $${paramCount}
      )`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.dateFrom) {
      query += ` AND voted_at >= $${paramCount++}`;
      values.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ` AND voted_at <= $${paramCount++}`;
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      values.push(toDate);
    }

    query += ' ORDER BY voted_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount++}`;
      values.push(filters.limit);
    }
    if (filters.offset) {
      query += ` OFFSET $${paramCount++}`;
      values.push(filters.offset);
    }

    const result = await pool.query(query, values);
    return result.rows;
  }

  static async getTotalCountWithFilters(
    surveyId: number,
    filters: {
      questionId?: number;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM votes WHERE survey_id = $1';
    const values: any[] = [surveyId];
    let paramCount = 2;

    if (filters.questionId) {
      query += ` AND question_id = $${paramCount++}`;
      values.push(filters.questionId);
    }

    if (filters.search) {
      query += ` AND (
        answer_text ILIKE $${paramCount} OR
        session_id ILIKE $${paramCount} OR
        ip_address ILIKE $${paramCount}
      )`;
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.dateFrom) {
      query += ` AND voted_at >= $${paramCount++}`;
      values.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ` AND voted_at <= $${paramCount++}`;
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      values.push(toDate);
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count);
  }

  static async hasVoted(surveyId: number, questionId: number, sessionId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM votes
      WHERE survey_id = $1 AND question_id = $2 AND session_id = $3
    `;
    const result = await pool.query(query, [surveyId, questionId, sessionId]);
    return parseInt(result.rows[0].count) > 0;
  }

  static async getAggregateByQuestion(questionId: number): Promise<VoteAggregate[]> {
    const query = `
      SELECT 
        v.option_id,
        o.option_text,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM votes WHERE question_id = $1), 0), 2) as percentage
      FROM votes v
      LEFT JOIN options o ON v.option_id = o.id
      WHERE v.question_id = $1
      GROUP BY v.option_id, o.option_text
      ORDER BY count DESC
    `;
    const result = await pool.query(query, [questionId]);
    // percentageを数値に変換
    return result.rows.map(row => ({
      ...row,
      percentage: parseFloat(row.percentage) || 0,
      count: parseInt(row.count) || 0,
    }));
  }

  static async getTimeSeries(surveyId: number, startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = `
      SELECT 
        DATE_TRUNC('hour', voted_at) as hour,
        COUNT(*) as count
      FROM votes
      WHERE survey_id = $1
    `;
    const values: any[] = [surveyId];

    if (startDate) {
      query += ` AND voted_at >= $${values.length + 1}`;
      values.push(startDate);
    }
    if (endDate) {
      query += ` AND voted_at <= $${values.length + 1}`;
      values.push(endDate);
    }

    query += ` GROUP BY hour ORDER BY hour ASC`;
    
    const result = await pool.query(query, values);
    return result.rows;
  }

  static async getTotalCount(surveyId: number): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM votes WHERE survey_id = $1';
    const result = await pool.query(query, [surveyId]);
    return parseInt(result.rows[0].count);
  }

  static async getCrossTabulation(questionId1: number, questionId2: number): Promise<any[]> {
    const query = `
      SELECT 
        v1.option_id as option1_id,
        o1.option_text as option1_text,
        v2.option_id as option2_id,
        o2.option_text as option2_text,
        COUNT(*) as count
      FROM votes v1
      INNER JOIN votes v2 ON v1.survey_id = v2.survey_id AND v1.session_id = v2.session_id
      LEFT JOIN options o1 ON v1.option_id = o1.id
      LEFT JOIN options o2 ON v2.option_id = o2.id
      WHERE v1.question_id = $1 AND v2.question_id = $2
      GROUP BY v1.option_id, o1.option_text, v2.option_id, o2.option_text
      ORDER BY count DESC
    `;
    const result = await pool.query(query, [questionId1, questionId2]);
    return result.rows;
  }

  static async getHeatmapData(surveyId: number, questionId: number): Promise<any[]> {
    const query = `
      SELECT 
        DATE_TRUNC('hour', voted_at) as hour,
        v.option_id,
        o.option_text,
        COUNT(*) as count
      FROM votes v
      LEFT JOIN options o ON v.option_id = o.id
      WHERE v.survey_id = $1 AND v.question_id = $2
      GROUP BY hour, v.option_id, o.option_text
      ORDER BY hour ASC, v.option_id ASC
    `;
    const result = await pool.query(query, [surveyId, questionId]);
    return result.rows;
  }
}

