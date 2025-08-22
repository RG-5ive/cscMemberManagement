// Script to check if users exist in the database
import pkg from 'pg';
const { Pool } = pkg;

async function checkUsers() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('To test locally, create a .env file with your DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Checking database connection...');
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does not exist');
      console.log('💡 You may need to run: npm run db:push');
      return;
    }
    
    console.log('✅ Users table exists');
    
    // Count total users
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Total users in database: ${userCount.rows[0].count}`);
    
    if (userCount.rows[0].count === '0') {
      console.log('⚠️  No users found in database!');
      console.log('💡 You need to import users: npm run import-users');
      return;
    }
    
    // Show sample users
    const sampleUsers = await pool.query(`
      SELECT id, email, role, "firstName", "lastName", 
             CASE WHEN password IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password
      FROM users 
      LIMIT 5
    `);
    
    console.log('\n👥 Sample users:');
    sampleUsers.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.role}) - Password: ${user.has_password}`);
    });
    
    // Check for specific test user
    const testEmails = [
      'forbesfilm@gmail.com',
      'rion.gonzales@gmail.com',
      'admin@example.com'
    ];
    
    console.log('\n🔍 Checking for test users:');
    for (const email of testEmails) {
      const userCheck = await pool.query(
        'SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      
      if (userCheck.rows.length > 0) {
        const user = userCheck.rows[0];
        console.log(`✅ Found: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
      } else {
        console.log(`❌ Not found: ${email}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('💡 Database or table does not exist. Run: npm run db:push');
    } else if (error.message.includes('authentication failed')) {
      console.log('💡 Database authentication failed. Check your DATABASE_URL');
    } else if (error.message.includes('connect')) {
      console.log('💡 Cannot connect to database. Check your DATABASE_URL and network');
    }
  } finally {
    await pool.end();
  }
}

checkUsers().catch(console.error); 