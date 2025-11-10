import { pool } from '../database/connection';
import bcrypt from 'bcrypt';

export interface Admin {
  id: number;
  username: string;
  password_hash: string;
  email: string;
  role: 'admin' | 'viewer';
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface CreateAdminInput {
  username: string;
  password: string;
  email: string;
  role?: 'admin' | 'viewer';
}

export class AdminModel {
  static async create(input: CreateAdminInput): Promise<Omit<Admin, 'password_hash'>> {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const query = `
      INSERT INTO admins (username, password_hash, email, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, role, created_at, updated_at, last_login_at
    `;
    const values = [
      input.username,
      passwordHash,
      input.email,
      input.role || 'viewer',
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async findByUsername(username: string): Promise<Admin | null> {
    const query = 'SELECT * FROM admins WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
  }

  static async findById(id: number): Promise<Omit<Admin, 'password_hash'> | null> {
    const query = 'SELECT id, username, email, role, created_at, updated_at, last_login_at FROM admins WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async verifyPassword(admin: Admin, password: string): Promise<boolean> {
    return await bcrypt.compare(password, admin.password_hash);
  }

  static async updateLastLogin(id: number): Promise<void> {
    const query = 'UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1';
    await pool.query(query, [id]);
  }
}

