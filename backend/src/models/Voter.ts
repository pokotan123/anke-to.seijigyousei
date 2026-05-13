import { pool } from '../database/connection';
import crypto from 'crypto';

export interface Voter {
  id: number;
  survey_id: number; // 投票アンケートID
  registration_survey_id: number | null; // 登録元アンケートID（1対N対応）
  email: string;
  voter_token: string;
  status: 'registered' | 'sent' | 'voted' | 'expired';
  registered_at: Date;
  link_sent_at: Date | null;
  voted_at: Date | null;
  reminder_sent_at: Date | null;
  ip_address: string | null;
  registration_data: Record<string, string> | null;
}

export interface CreateVoterInput {
  survey_id: number;
  registration_survey_id?: number | null;
  email: string;
  ip_address?: string;
  registration_data?: Record<string, string>;
}

/** email 正規化（NFKC + trim + lowercase）*/
export function normalizeEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase();
}

export interface VoterSummary {
  total: number;
  registered: number;
  sent: number;
  voted: number;
  expired: number;
}

export class VoterModel {
  static generateVoterToken(): string {
    const uuid = crypto.randomUUID();
    return crypto.createHash('sha256').update(uuid).digest('hex');
  }

  static async create(input: CreateVoterInput): Promise<Voter> {
    const voterToken = this.generateVoterToken();
    const query = `
      INSERT INTO voters (survey_id, registration_survey_id, email, voter_token, ip_address, registration_data)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      input.survey_id,
      input.registration_survey_id || null,
      input.email,
      voterToken,
      input.ip_address || null,
      input.registration_data ? JSON.stringify(input.registration_data) : '{}',
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /** 登録元アンケートで登録済みの voter 一覧（email でユニーク）*/
  static async findByRegistrationSurveyId(registrationSurveyId: number): Promise<Voter[]> {
    const query = `
      SELECT DISTINCT ON (email) *
      FROM voters
      WHERE registration_survey_id = $1
      ORDER BY email, registered_at ASC
    `;
    const result = await pool.query(query, [registrationSurveyId]);
    return result.rows;
  }

  static async findById(id: number): Promise<Voter | null> {
    const query = 'SELECT * FROM voters WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async findByToken(voterToken: string): Promise<Voter | null> {
    const query = 'SELECT * FROM voters WHERE voter_token = $1';
    const result = await pool.query(query, [voterToken]);
    return result.rows[0] || null;
  }

  static async findByEmail(surveyId: number, email: string): Promise<Voter | null> {
    const query = 'SELECT * FROM voters WHERE survey_id = $1 AND email = $2';
    const result = await pool.query(query, [surveyId, email]);
    return result.rows[0] || null;
  }

  static async findBySurveyId(surveyId: number): Promise<Voter[]> {
    const query = 'SELECT * FROM voters WHERE survey_id = $1 ORDER BY registered_at DESC';
    const result = await pool.query(query, [surveyId]);
    return result.rows;
  }

  static async findBySurveyIdAndStatus(surveyId: number, status: Voter['status']): Promise<Voter[]> {
    const query = 'SELECT * FROM voters WHERE survey_id = $1 AND status = $2 ORDER BY registered_at DESC';
    const result = await pool.query(query, [surveyId, status]);
    return result.rows;
  }

  static async updateStatus(id: number, status: Voter['status']): Promise<Voter | null> {
    const timestampField = this.getTimestampField(status);
    const query = timestampField
      ? `UPDATE voters SET status = $1, ${timestampField} = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`
      : `UPDATE voters SET status = $1 WHERE id = $2 RETURNING *`;
    const result = await pool.query(query, [status, id]);
    return result.rows[0] || null;
  }

  static async markAsSent(id: number): Promise<Voter | null> {
    return this.updateStatus(id, 'sent');
  }

  static async markAsVoted(id: number): Promise<Voter | null> {
    return this.updateStatus(id, 'voted');
  }

  static async updateReminderSent(id: number): Promise<Voter | null> {
    const query = `
      UPDATE voters SET reminder_sent_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async getSummary(surveyId: number): Promise<VoterSummary> {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'registered') as registered,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'voted') as voted,
        COUNT(*) FILTER (WHERE status = 'expired') as expired
      FROM voters
      WHERE survey_id = $1
    `;
    const result = await pool.query(query, [surveyId]);
    const row = result.rows[0];
    return {
      total: parseInt(row.total) || 0,
      registered: parseInt(row.registered) || 0,
      sent: parseInt(row.sent) || 0,
      voted: parseInt(row.voted) || 0,
      expired: parseInt(row.expired) || 0,
    };
  }

  static async markAsVotedByToken(voterToken: string): Promise<Voter | null> {
    const query = `
      UPDATE voters SET status = 'voted', voted_at = CURRENT_TIMESTAMP
      WHERE voter_token = $1 AND status != 'voted'
      RETURNING *
    `;
    const result = await pool.query(query, [voterToken]);
    return result.rows[0] || null;
  }

  private static getTimestampField(status: Voter['status']): string | null {
    const map: Record<string, string> = {
      sent: 'link_sent_at',
      voted: 'voted_at',
    };
    return map[status] || null;
  }
}
