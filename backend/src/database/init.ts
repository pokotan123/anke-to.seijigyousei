import { connectDatabase, pool } from './connection';
import { AdminModel } from '../models/Admin';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';
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

    // SQLを分割して実行（セミコロンで区切る）
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    let executedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          await pool.query(statement);
          executedCount++;
          if (i < 5 || statement.includes('CREATE TABLE')) {
            console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
          }
        } catch (error: any) {
          // 既に存在するエラーは無視
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`ℹ️  Statement ${i + 1} already exists, skipping`);
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            console.error(`   Statement: ${statement.substring(0, 100)}...`);
            errorCount++;
          }
        }
      }
    }

    console.log(`✅ Migration completed: ${executedCount} statements executed, ${errorCount} errors`);

    console.log('🌱 Seeding database...');
    // 管理者アカウント作成（パスワード: admin123）
    const admin = await AdminModel.create({
      username: 'admin',
      password: 'admin123',
      email: 'admin@example.com',
      role: 'admin',
    });
    console.log('✅ Admin created:', admin.username);

    // サンプルアンケート作成
    const survey = await SurveyModel.create({
      title: 'サンプルアンケート',
      description: 'これはサンプルアンケートです',
      status: 'published',
      start_date: new Date(),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後
      created_by: admin.id,
    });
    console.log('✅ Survey created:', survey.title);
    console.log('📋 Survey URL:', `http://localhost:3000/vote/${survey.unique_token}`);

    // サンプル質問作成
    const question1 = await QuestionModel.create({
      survey_id: survey.id,
      question_text: 'このシステムは使いやすいですか？',
      question_type: 'single_choice',
      order: 1,
      is_required: true,
    });

    await OptionModel.create({ question_id: question1.id, option_text: 'とても使いやすい', order: 1 });
    await OptionModel.create({ question_id: question1.id, option_text: '使いやすい', order: 2 });
    await OptionModel.create({ question_id: question1.id, option_text: '普通', order: 3 });
    await OptionModel.create({ question_id: question1.id, option_text: '使いにくい', order: 4 });
    await OptionModel.create({ question_id: question1.id, option_text: 'とても使いにくい', order: 5 });

    await QuestionModel.create({
      survey_id: survey.id,
      question_text: '改善してほしい点があれば教えてください',
      question_type: 'text',
      order: 2,
      is_required: false,
    });

    console.log('✅ Questions created');

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

