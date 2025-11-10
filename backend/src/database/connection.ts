import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Railway環境変数の確認
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('Please set DATABASE_URL in Railway environment variables.');
  console.error('Expected format: postgresql://user:password@host:port/database');
}

const pool = new Pool({
  connectionString: databaseUrl || 
    `postgresql://${process.env.DB_USER || 'survey_user'}:${process.env.DB_PASSWORD || 'survey_password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'survey_db'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function connectDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected');
    client.release();
    return pool;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    throw error;
  }
}

export { pool };

