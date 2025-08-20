// Simple script to push schema to database
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './shared/schema.js';

async function main() {
  console.log('Connecting to database...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  const connectionString = process.env.DATABASE_URL;
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql, { schema });
  
  console.log('Creating tables if they do not exist...');
  
  try {
    // Execute table creation queries directly
    await sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "username" TEXT,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "firstName" TEXT,
        "lastName" TEXT,
        "role" TEXT DEFAULT 'user',
        "memberLevel" TEXT,
        "location" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" SERIAL PRIMARY KEY,
        "senderId" INTEGER NOT NULL,
        "recipientId" INTEGER NOT NULL,
        "content" TEXT NOT NULL,
        "subject" TEXT,
        "read" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "surveys" (
        "id" SERIAL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "questions" JSONB NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "createdBy" INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS "survey_responses" (
        "id" SERIAL PRIMARY KEY,
        "surveyId" INTEGER NOT NULL,
        "userId" INTEGER NOT NULL,
        "answers" JSONB NOT NULL,
        "submittedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "workshops" (
        "id" SERIAL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "date" TIMESTAMP NOT NULL,
        "location" TEXT,
        "capacity" INTEGER,
        "instructor" TEXT
      );
      
      CREATE TABLE IF NOT EXISTS "workshop_registrations" (
        "id" SERIAL PRIMARY KEY,
        "workshopId" INTEGER NOT NULL,
        "userId" INTEGER NOT NULL,
        "status" TEXT DEFAULT 'confirmed',
        "registeredAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "verification_codes" (
        "id" SERIAL PRIMARY KEY,
        "email" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "firstName" TEXT,
        "lastName" TEXT,
        "verified" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" TEXT NOT NULL PRIMARY KEY,
        "sess" JSONB NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL
      );
    `;
    
    console.log('Tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    await sql.end();
    console.log('Database connection closed');
  }
}

main();