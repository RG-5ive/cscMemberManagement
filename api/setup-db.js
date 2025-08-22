// API endpoint to set up database tables
const { Pool } = require('pg');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Simple security check
  const { secret } = req.body;
  if (secret !== 'setup-database-2024') {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Setting up database tables...');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        "firstName" TEXT,
        "lastName" TEXT,
        role TEXT DEFAULT 'user',
        "memberLevel" TEXT,
        location TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create session table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid TEXT PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
    `);
    
    // Check table counts
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const sessionCount = await pool.query('SELECT COUNT(*) FROM session');
    
    console.log('Database setup completed successfully');
    
    res.json({
      success: true,
      message: 'Database tables created successfully',
      tables: {
        users: parseInt(userCount.rows[0].count),
        sessions: parseInt(sessionCount.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('Database setup error:', error);
    res.status(500).json({ 
      error: 'Database setup failed', 
      details: error.message 
    });
  } finally {
    await pool.end();
  }
}; 