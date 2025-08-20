import pg from 'pg';

const { Pool } = pg;

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  try {
    const email = 'rion.gonzales@gmail.com';
    
    // Get all accounts with this email (case insensitive)
    const result = await pool.query(
      `SELECT id, username, email, role, password, created_at 
       FROM users 
       WHERE LOWER(email) = LOWER($1)
       ORDER BY id`,
      [email]
    );
    
    if (result.rows.length === 0) {
      console.log(`No users found with email ${email}`);
      return;
    }
    
    console.log(`Found ${result.rows.length} accounts with email ${email}:`);
    
    result.rows.forEach(user => {
      console.log(`\nAccount ID: ${user.id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log(`Password Hash (first 20 chars): ${user.password.substring(0, 20)}...`);
      console.log(`Created At: ${user.created_at}`);
    });
    
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the script
main();