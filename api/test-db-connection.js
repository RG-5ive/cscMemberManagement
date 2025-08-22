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
  
  // Test 1: SSL require (NeonDB recommended)
  try {
    const pool1 = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { require: true }
    });
    const result = await pool1.query('SELECT NOW() as current_time, version() as db_version');
    await pool1.end();
    results.push(`✅ SSL require: SUCCESS - ${result.rows[0].db_version}`);
  } catch (error) {
    results.push(`❌ SSL require: ${error.message}`);
  }

  // Test 2: Direct NeonDB connection with manual config
  try {
    const pool2 = new Pool({
      host: 'ep-falling-pine-a6yv1efa.us-west-2.aws.neon.tech',
      port: 5432,
      database: 'neondb',
      user: 'neondb_owner',
      password: 'npg_1KEYNRu0MHdG',
      ssl: { require: true }
    });
    const result = await pool2.query('SELECT NOW() as current_time');
    await pool2.end();
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