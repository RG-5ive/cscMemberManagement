// Test endpoint to debug NeonDB connection
import pg from 'pg';
const { Pool } = pg;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secret } = req.body;
  if (secret !== 'test-db-connection') {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const results = [];
  
  // Test with manual NeonDB-specific configuration
  try {
    console.log('Testing manual NeonDB configuration...');
    
    // Parse DATABASE_URL for manual connection
    const url = new URL(process.env.DATABASE_URL);
    const connectionString = process.env.DATABASE_URL; // Use environment variable instead of hardcoded value
    
    const manualPool = new Pool({
      connectionString: connectionString,
      ssl: { require: true }
    });
    const result = await manualPool.query('SELECT NOW() as current_time');
    await manualPool.end();
    results.push('✅ Manual NeonDB config: SUCCESS');
  } catch (error) {
    results.push(`❌ Manual NeonDB config: ${error.message}`);
  }

  // Test 3: Connection string with sslmode
  try {
    const connectionString = 'postgresql://neondb_owner:npg_1KEYNRu0MHdG@ep-falling-pine-a6yv1efa.us-west-2.aws.neon.tech/neondb?sslmode=require';
    const pool3 = new Pool({
      connectionString
    });
    const result = await pool3.query('SELECT NOW() as current_time');
    await pool3.end();
    results.push('✅ NeonDB connection string with sslmode: SUCCESS');
  } catch (error) {
    results.push(`❌ NeonDB connection string with sslmode: ${error.message}`);
  }

  res.json({
    message: 'NeonDB connection tests completed',
    results,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      databaseUrlExists: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
      databaseUrlStart: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'not set'
    }
  });
} 