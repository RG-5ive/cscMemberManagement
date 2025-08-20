import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

console.log("DATABASE_URL:", process.env.DATABASE_URL);

async function main() {
  console.log("Connecting to database...");
  
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  
  // Create a PostgreSQL client for migrations
  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
  
  // Create a separate client for schema pushing
  const pushClient = postgres(process.env.DATABASE_URL, { max: 1 });
  
  // Create Drizzle instance
  const db = drizzle(pushClient);
  
  console.log("Pushing schema changes...");
  
  try {
    // Use SQL directly to push schema changes
    console.log("Creating committees table if not exists...");
    await pushClient`
      CREATE TABLE IF NOT EXISTS committees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log("Creating workshop_types table if not exists...");
    await pushClient`
      CREATE TABLE IF NOT EXISTS workshop_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      );
    `;

    console.log("Altering workshops table...");
    // Check if the committee_id column already exists
    const committeeColExists = await pushClient`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'workshops' AND column_name = 'committee_id';
    `;

    if (committeeColExists.length === 0) {
      console.log("Adding committee_id column to workshops table...");
      await pushClient`
        ALTER TABLE workshops 
        ADD COLUMN committee_id INTEGER REFERENCES committees(id),
        ADD COLUMN location_address TEXT,
        ADD COLUMN location_details TEXT,
        ADD COLUMN is_paid BOOLEAN DEFAULT false,
        ADD COLUMN fee INTEGER,
        ADD COLUMN is_online BOOLEAN DEFAULT false,
        ADD COLUMN meeting_link TEXT,
        ADD COLUMN workshop_type_id INTEGER REFERENCES workshop_types(id),
        ADD COLUMN requires_approval BOOLEAN DEFAULT false,
        ADD COLUMN created_by_id INTEGER REFERENCES users(id),
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `;
    }

    // Check if approval columns exist in workshop_registrations
    const approvalColExists = await pushClient`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'workshop_registrations' AND column_name = 'is_approved';
    `;

    if (approvalColExists.length === 0) {
      console.log("Adding approval and payment columns to workshop_registrations table...");
      await pushClient`
        ALTER TABLE workshop_registrations 
        ADD COLUMN is_approved BOOLEAN DEFAULT false,
        ADD COLUMN approved_by_id INTEGER REFERENCES users(id),
        ADD COLUMN approved_at TIMESTAMP,
        ADD COLUMN payment_status TEXT DEFAULT 'not_required',
        ADD COLUMN payment_confirmed_by_id INTEGER REFERENCES users(id),
        ADD COLUMN payment_confirmed_at TIMESTAMP,
        ADD COLUMN notes TEXT;
      `;
    }

    console.log("Schema changes pushed successfully!");
  } catch (error) {
    console.error("Error pushing schema:", error);
    process.exit(1);
  } finally {
    await pushClient.end();
    await migrationClient.end();
  }
}

main().catch(console.error);