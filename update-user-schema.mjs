import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

async function updateUserSchema() {
  console.log('Adding first_name and last_name fields to users table...');
  
  try {
    // Add firstName column if it doesn't exist
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_name TEXT
    `;
    console.log('Added first_name column');
    
    // Add lastName column if it doesn't exist
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_name TEXT
    `;
    console.log('Added last_name column');
    
    console.log('Database schema updated successfully!');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    await sql.end();
  }
}

updateUserSchema();