import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Railway環境変数の確認
// Railwayでは、PostgreSQLサービスを追加すると自動的にDATABASE_URLが設定されます
// バックエンドサービスで、${{PostgreSQL.DATABASE_URL}}として参照する必要があります
const databaseUrl = process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  process.env.POSTGRES_CONNECTION_STRING;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('');
  console.error('📋 Railwayでの設定方法:');
  console.error('  1. PostgreSQLサービスを追加（まだの場合）');
  console.error('  2. バックエンドサービスの「Variables」タブを開く');
  console.error('  3. 以下の環境変数を追加:');
  console.error('     DATABASE_URL=${{PostgreSQL.DATABASE_URL}}');
  console.error('  4. 「PostgreSQL」の部分は、実際のサービス名に置き換えてください');
  console.error('');
  console.error('💡 代替方法: PostgreSQLサービスの「Variables」タブから');
  console.error('   DATABASE_URLの値をコピーして、直接設定することもできます');
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

