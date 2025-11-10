import { connectDatabase } from './connection';
import { pool } from './connection';
import bcrypt from 'bcrypt';

async function resetAdminPassword() {
  try {
    await connectDatabase();

    const newPassword = 'admin123';
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const query = `
      UPDATE admins 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE username = 'admin'
      RETURNING id, username, email, role
    `;

    const result = await pool.query(query, [passwordHash]);
    
    if (result.rows.length > 0) {
      console.log('✅ Admin password reset successfully');
      console.log('📝 Login credentials:');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('❌ Admin user not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetAdminPassword();

