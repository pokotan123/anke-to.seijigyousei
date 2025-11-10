import { connectDatabase } from './connection';
import { AdminModel } from '../models/Admin';
import { SurveyModel } from '../models/Survey';
import { QuestionModel } from '../models/Question';
import { OptionModel } from '../models/Option';

async function seed() {
  try {
    await connectDatabase();

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

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seed();

