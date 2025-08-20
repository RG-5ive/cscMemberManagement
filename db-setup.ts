// db-setup.ts - Create or update all required database tables
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  console.log('Starting database setup...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('Connected to database. Creating tables...');
    
    // Create tables if they don't exist
    await pool.query(`
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
    `);
    
    console.log('Tables created successfully!');
    
    // Create a demo admin user if it doesn't exist
    await pool.query(`
      INSERT INTO users (username, email, password, firstName, lastName, role)
      VALUES ('admin', 'admin@example.com', '${"$2b$10$BUli0c.muyCW1ErNJc3jL.vFRFtFJWrT8/GcR4A.sUdCznaXiqFXa"}', 'Admin', 'User', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `);
    console.log('Demo admin user created (or already exists)');
    
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

setupDatabase().catch(console.error);