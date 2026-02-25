import { Pool, types } from 'pg';
import dotenv from 'dotenv';

// TIMESTAMP (OID 1114) をJST ISO文字列で返す
types.setTypeParser(1114, (val: string) => {
  if (!val) return null;
  const utc = new Date(val + 'Z');
  const jstMs = utc.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMs);
  return jst.toISOString().replace('Z', '+09:00');
});

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
  // 接続プールの設定
  max: parseInt(process.env.DB_POOL_MAX || '20', 10), // 最大接続数（デフォルト: 20）
  min: parseInt(process.env.DB_POOL_MIN || '2', 10), // 最小接続数（デフォルト: 2）
  idleTimeoutMillis: 30000, // アイドル接続のタイムアウト（30秒）
  connectionTimeoutMillis: 2000, // 接続タイムアウト（2秒）
});

export async function connectDatabase() {
  try {
    // デバッグ情報
    const connectionString = pool.options.connectionString;
    if (connectionString) {
      // パスワードをマスクして表示
      const maskedUrl = connectionString.replace(/:[^:@]+@/, ':****@');
      console.log('🔗 Attempting to connect to:', maskedUrl);
    } else {
      console.error('❌ Connection string is empty!');
    }
    
    const client = await pool.connect();
    console.log('✅ Database connected');

    // 自動マイグレーション: 不足カラムを追加
    try {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='vote_mail_body') THEN
            ALTER TABLE surveys ADD COLUMN vote_mail_body TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='reminder_mail_body') THEN
            ALTER TABLE surveys ADD COLUMN reminder_mail_body TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_mail_body') THEN
            ALTER TABLE surveys ADD COLUMN registration_mail_body TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='registration_start_date') THEN
            ALTER TABLE surveys ADD COLUMN registration_start_date TIMESTAMP;
          END IF;
        END $$;
      `);
      console.log('✅ Auto-migration completed');
    } catch (migrationError) {
      console.error('⚠️ Auto-migration warning:', migrationError);
    }

    client.release();
    return pool;
  } catch (error: any) {
    console.error('❌ Database connection error:', error);
    console.error('');
    console.error('🔍 Debug information:');
    console.error('  DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'NOT SET');
    console.error('  POSTGRES_URL:', process.env.POSTGRES_URL ? 'Set' : 'NOT SET');
    console.error('  POSTGRES_CONNECTION_STRING:', process.env.POSTGRES_CONNECTION_STRING ? 'Set' : 'NOT SET');
    console.error('  NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.error('');
    console.error('💡 Railwayでの設定確認:');
    console.error('  1. バックエンドサービスの「Variables」タブを確認');
    console.error('  2. DATABASE_URLが設定されているか確認');
    console.error('  3. 値が ${{PostgreSQL.DATABASE_URL}} の形式か確認');
    console.error('  4. PostgreSQLサービスの名前が正確か確認');
    throw error;
  }
}

export { pool };

