import { neon } from '@neondatabase/serverless';

// Test with a simple query that wakes up sleeping databases
const testConnection = async () => {
  console.log('Testing database connection...');
  
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    const result = await sql`SELECT 1 as test, current_user, current_database()`;
    console.log('✅ Database connection successful!');
    console.log('Result:', result);
    return true;
  } catch (error) {
    console.log('❌ Database connection failed:');
    console.log('Error:', error.message);
    return false;
  }
};

testConnection();
