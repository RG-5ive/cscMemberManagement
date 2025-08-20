import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

async function createVerificationTable() {
  console.log('Creating verification_codes table...');
  
  try {
    // Create verification_codes table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        code VARCHAR(7) NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    console.log('Verification codes table created successfully!');
  } catch (error) {
    console.error('Error creating verification_codes table:', error);
  } finally {
    await sql.end();
  }
}

createVerificationTable();