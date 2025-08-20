import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
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

async function updateSchema() {
  console.log('Adding contact fields to users table...');
  
  try {
    // Add phoneNumber column if it doesn't exist
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone_number TEXT
    `;
    console.log('Added phone_number column');
    
    // Add alternateEmail column if it doesn't exist
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS alternate_email TEXT
    `;
    console.log('Added alternate_email column');
    
    // Add emergencyContact column if it doesn't exist
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS emergency_contact TEXT
    `;
    console.log('Added emergency_contact column');
    
    // Add emergencyPhone column if it doesn't exist
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS emergency_phone TEXT
    `;
    console.log('Added emergency_phone column');
    
    console.log('Database schema updated successfully!');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    await sql.end();
  }
}

updateSchema();