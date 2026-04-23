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

      // 監査ログテーブル（個人情報取扱覚書 第6条3項対応 / 設計書 v2.3 準拠）
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          admin_id_snapshot INTEGER NOT NULL,
          admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
          admin_username VARCHAR(100),
          action VARCHAR(50) NOT NULL,
          resource_type VARCHAR(50),
          resource_id VARCHAR(100),
          http_method VARCHAR(10) NOT NULL,
          endpoint VARCHAR(500) NOT NULL,
          route_pattern VARCHAR(255),
          status_code INTEGER NOT NULL,
          ip_address VARCHAR(45),
          user_agent VARCHAR(500),
          details JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created ON audit_logs(admin_id_snapshot, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_created ON audit_logs(resource_type, resource_id, created_at DESC);
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

