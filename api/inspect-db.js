// Inspect existing database schema
import pg from 'pg';
const { Pool } = pg;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secret } = req.body;
  if (secret !== 'inspect-database') {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { require: true }
  });

  try {
    const results = {};

    // Get all tables in the database
    const tablesQuery = `
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const tables = await pool.query(tablesQuery);
    results.tables = tables.rows;

    // Get detailed info about each table
    results.tableDetails = {};
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      // Get column information
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `;
      const columns = await pool.query(columnsQuery, [tableName]);
      
      // Get row count
      const countQuery = `SELECT COUNT(*) as row_count FROM "${tableName}"`;
      const count = await pool.query(countQuery);
      
      // Get sample data (first 3 rows)
      const sampleQuery = `SELECT * FROM "${tableName}" LIMIT 3`;
      const sample = await pool.query(sampleQuery);
      
      results.tableDetails[tableName] = {
        columns: columns.rows,
        rowCount: parseInt(count.rows[0].row_count),
        sampleData: sample.rows
      };
    }

    // If users table exists, get more detailed info
    if (results.tableDetails.users) {
      const usersTable = results.tableDetails.users;
      results.usersTableAnalysis = {
        totalUsers: usersTable.rowCount,
        columnNames: usersTable.columns.map(col => col.column_name),
        hasEmailColumn: usersTable.columns.some(col => col.column_name === 'email'),
        hasPasswordColumn: usersTable.columns.some(col => col.column_name === 'password'),
        hasUsernameColumn: usersTable.columns.some(col => col.column_name === 'username'),
        hasIdColumn: usersTable.columns.some(col => col.column_name === 'id'),
        sampleEmails: usersTable.sampleData.map(user => user.email).filter(Boolean)
      };
    }

    res.json({
      success: true,
      message: 'Database inspection completed',
      ...results
    });

  } catch (error) {
    console.error('Database inspection error:', error);
    res.status(500).json({ 
      error: 'Database inspection failed', 
      details: error.message 
    });
  } finally {
    await pool.end();
  }
} 