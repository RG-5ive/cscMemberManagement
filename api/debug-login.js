// Debug endpoint to check login issues
const { Pool } = require('pg');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, secret } = req.body;
  
  // Simple security check
  if (secret !== 'debug-login-2024') {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ 
      error: 'DATABASE_URL not configured',
      envVars: Object.keys(process.env).filter(key => key.includes('DATABASE'))
    });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check database connection
    await pool.query('SELECT NOW()');
    
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json({
        status: 'error',
        issue: 'Users table does not exist',
        solution: 'Call /api/setup-db first'
      });
    }
    
    // Count total users
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    
    if (userCount.rows[0].count === '0') {
      return res.json({
        status: 'error',
        issue: 'No users in database',
        solution: 'Call /api/import-users first',
        totalUsers: 0
      });
    }
    
    // Check for specific user
    let userInfo = null;
    if (email) {
      const userCheck = await pool.query(
        'SELECT id, email, role, "firstName", "lastName", username FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
      
      if (userCheck.rows.length > 0) {
        userInfo = userCheck.rows[0];
      }
    }
    
    // Sample users
    const sampleUsers = await pool.query(`
      SELECT id, email, role, "firstName", "lastName"
      FROM users 
      LIMIT 3
    `);
    
    res.json({
      status: 'success',
      database: {
        connected: true,
        usersTableExists: true,
        totalUsers: parseInt(userCount.rows[0].count)
      },
      searchedUser: userInfo ? {
        found: true,
        user: userInfo
      } : {
        found: false,
        searchedEmail: email
      },
      sampleUsers: sampleUsers.rows,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      code: error.code,
      details: error.toString()
    });
  } finally {
    await pool.end();
  }
}; 