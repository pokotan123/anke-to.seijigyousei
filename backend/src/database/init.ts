import { connectDatabase, pool } from './connection';
import { AdminModel } from '../models/Admin';
import fs from 'fs';
import path from 'path';

async function init() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected');

    console.log('📦 Running migration...');
    // init.sqlを読み込んで実行
    // __dirnameはコンパイル後のdistディレクトリを指す
    // ソースコードから見たパス: backend/src/database/init.ts
    // コンパイル後: backend/dist/database/init.js
    // SQLファイル: backend/database/init.sql
    const initSqlPath = path.join(__dirname, '../../database/init.sql');
    console.log('📄 Reading SQL file from:', initSqlPath);
    console.log('📄 Current working directory:', process.cwd());
    console.log('📄 __dirname:', __dirname);
    
    // 複数のパスを試す
    const possiblePaths = [
      path.join(__dirname, '../../database/init.sql'),
      path.join(process.cwd(), 'backend/database/init.sql'),
      path.join(process.cwd(), 'database/init.sql'),
    ];
    
    let sql = '';
    let foundPath = '';
    
    for (const sqlPath of possiblePaths) {
      console.log(`🔍 Checking path: ${sqlPath}`);
      if (fs.existsSync(sqlPath)) {
        console.log(`✅ Found SQL file at: ${sqlPath}`);
        foundPath = sqlPath;
        sql = fs.readFileSync(sqlPath, 'utf-8');
        break;
      }
    }
    
    if (!sql) {
      throw new Error(`SQL file not found. Checked paths: ${possiblePaths.join(', ')}`);
    }
    
    console.log(`📄 SQL file loaded from ${foundPath} (${sql.length} characters)`);

    // SQLファイル全体を一度に実行
    // PostgreSQLは複数のSQL文を一度に実行できます
    // セミコロンで分割すると、複数行のSQL文（CREATE FUNCTION、CREATE TRIGGERなど）が正しく分割されないため
    try {
      console.log('📝 Executing SQL file...');
      await pool.query(sql);
      console.log('✅ Migration completed successfully');
    } catch (error: any) {
      // 既に存在するエラーは無視
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('ℹ️  Some objects already exist, continuing...');
      } else {
        console.error('❌ Migration error:', error.message);
        // エラーが発生した場合でも、テーブルが作成されている可能性があるので続行
        console.warn('⚠️  Continuing despite migration errors...');
      }
    }

    console.log('🌱 Seeding database...');
    // 管理者アカウント作成（パスワード: admin123）
    // 既に存在する場合はパスワードをリセット
    let admin;
    try {
      admin = await AdminModel.create({
        username: 'admin',
        password: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
      });
      console.log('✅ Admin created:', admin.username);
    } catch (error: any) {
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('already exists')) {
        console.log('ℹ️  Admin user already exists, resetting password...');
        // パスワードをリセット
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash('admin123', 10);
        const updateQuery = `
          UPDATE admins 
          SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
          WHERE username = 'admin'
          RETURNING id, username, email, role
        `;
        const result = await pool.query(updateQuery, [passwordHash]);
        if (result.rows.length > 0) {
          const foundAdmin = await AdminModel.findByUsername('admin');
          if (!foundAdmin) {
            throw new Error('Admin user should exist but could not be found');
          }
          admin = foundAdmin;
          console.log('✅ Admin password reset successfully');
        } else {
          throw new Error('Admin user should exist but could not be found');
        }
      } else {
        throw error;
      }
    }

    // adminがnullでないことを確認
    if (!admin) {
      throw new Error('Admin user is required but was not found or created');
    }

    // サンプルアンケートの作成は削除（必要に応じて管理画面から作成してください）

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  }
}

init();

