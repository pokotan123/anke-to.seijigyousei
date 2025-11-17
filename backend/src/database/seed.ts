import { connectDatabase } from './connection';
import { AdminModel } from '../models/Admin';

async function seed() {
  try {
    await connectDatabase();

    // 管理者アカウント作成（パスワード: admin123）
    // 既に存在する場合はエラーを無視
    try {
      const admin = await AdminModel.create({
        username: 'admin',
        password: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
      });
      console.log('✅ Admin created:', admin.username);
    } catch (error: any) {
      if (error.code === '23505' || error.message.includes('duplicate') || error.message.includes('already exists')) {
        console.log('ℹ️  Admin user already exists');
      } else {
        throw error;
      }
    }

    // サンプルアンケートの作成は削除（必要に応じて管理画面から作成してください）

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

