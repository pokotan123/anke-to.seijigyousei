import { pool } from '../database/connection';
import crypto from 'crypto';

export type MailType =
  | 'registration_confirmation'
  | 'new_voting_notification'
  | 'vote_link'
  | 'reminder';

export type MailStatus = 'pending' | 'sent' | 'failed' | 'dead';

export interface MailOutboxRow {
  id: number;
  idempotency_key: string;
  mail_type: MailType;
  to_email: string;
  payload: Record<string, any>;
  status: MailStatus;
  retry_count: number;
  last_error: string | null;
  last_attempt_at: Date | null;
  next_attempt_at: Date | null;
  created_at: Date;
  sent_at: Date | null;
  failed_at: Date | null;
}

export interface EnqueueInput {
  idempotency_key: string;
  mail_type: MailType;
  to_email: string;
  payload: Record<string, any>;
}

const RETRY_INTERVALS = [
  Number(process.env.MAIL_RETRY_INTERVAL_1 || 60),
  Number(process.env.MAIL_RETRY_INTERVAL_2 || 300),
  Number(process.env.MAIL_RETRY_INTERVAL_3 || 1800),
];
const RETRY_MAX = Number(process.env.MAIL_RETRY_MAX || 3);

export class MailOutbox {
  /** sha256(email)[:16] - 冪等性キー組成用 */
  static hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);
  }

  /** 対象集合（voter_id[]）のハッシュ — sort+join+sha256[:16] */
  static hashTargetSet(ids: number[]): string {
    const joined = [...ids].sort((a, b) => a - b).join(',');
    return crypto.createHash('sha256').update(joined).digest('hex').substring(0, 16);
  }

  /** Outbox に enqueue（冪等性キーで重複INSERTスキップ） */
  static async enqueue(client: any, input: EnqueueInput): Promise<MailOutboxRow | null> {
    const query = `
      INSERT INTO mail_outbox (idempotency_key, mail_type, to_email, payload, status, next_attempt_at)
      VALUES ($1, $2, $3, $4::jsonb, 'pending', CURRENT_TIMESTAMP)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *
    `;
    const res = await client.query(query, [
      input.idempotency_key,
      input.mail_type,
      input.to_email,
      JSON.stringify(input.payload),
    ]);
    return res.rows[0] || null;
  }

  /** 送信成功 */
  static async markSent(id: number): Promise<void> {
    await pool.query(
      `UPDATE mail_outbox SET status='sent', sent_at=CURRENT_TIMESTAMP, last_attempt_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [id]
    );
  }

  /** 送信失敗（retry_count++, 状態遷移） */
  static async markFailed(id: number, error: string): Promise<void> {
    const row = await pool.query(`SELECT retry_count FROM mail_outbox WHERE id=$1`, [id]);
    if (row.rows.length === 0) return;
    const retryCount = row.rows[0].retry_count + 1;
    if (retryCount >= RETRY_MAX) {
      await pool.query(
        `UPDATE mail_outbox SET status='dead', retry_count=$1, last_error=$2,
         last_attempt_at=CURRENT_TIMESTAMP, failed_at=CURRENT_TIMESTAMP WHERE id=$3`,
        [retryCount, error, id]
      );
    } else {
      const interval = RETRY_INTERVALS[retryCount] || RETRY_INTERVALS[RETRY_INTERVALS.length - 1];
      await pool.query(
        `UPDATE mail_outbox SET status='failed', retry_count=$1, last_error=$2,
         last_attempt_at=CURRENT_TIMESTAMP,
         next_attempt_at=CURRENT_TIMESTAMP + (INTERVAL '1 second' * $3)
         WHERE id=$4`,
        [retryCount, error, interval, id]
      );
    }
  }

  /** dead 一覧 */
  static async findDead(): Promise<MailOutboxRow[]> {
    const res = await pool.query(`SELECT * FROM mail_outbox WHERE status='dead' ORDER BY failed_at DESC LIMIT 100`);
    return res.rows;
  }

  /** dead → pending 再送 */
  static async resetForRetry(id: number): Promise<MailOutboxRow | null> {
    const res = await pool.query(
      `UPDATE mail_outbox SET status='pending', retry_count=0, last_error=NULL,
       next_attempt_at=CURRENT_TIMESTAMP, failed_at=NULL WHERE id=$1 RETURNING *`,
      [id]
    );
    return res.rows[0] || null;
  }

  /** 送信予定キュー取得（worker用、SKIP LOCKED） */
  static async fetchDuePending(client: any, limit = 50): Promise<MailOutboxRow[]> {
    const res = await client.query(
      `SELECT * FROM mail_outbox
       WHERE status IN ('pending','failed')
         AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
       ORDER BY next_attempt_at NULLS FIRST
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    return res.rows;
  }
}
