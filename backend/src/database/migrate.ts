import { connectDatabase, pool } from './connection';
import fs from 'fs';
import path from 'path';

async function migrate() {
  try {
    await connectDatabase();

    // init.sqlを読み込んで実行
    // Railway環境では、backend/database/init.sqlを優先的に使用
    const initSqlPath = path.join(__dirname, '../../database/init.sql');
    const sql = fs.readFileSync(initSqlPath, 'utf-8');

    // SQLを分割して実行（セミコロンで区切る）
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.length > 0) {
        try {
          await pool.query(statement);
        } catch (error: any) {
          // 既に存在するエラーは無視
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.warn('Warning:', error.message);
          }
        }
      }
    }

    console.log('✅ Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

migrate();

