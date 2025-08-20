// Script to import members from CSV file
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { members } from './shared/schema';

// Load environment variables
dotenv.config();

// CSV file path
const CSV_FILE_PATH = './attached_assets/Members List Cttee.2.csv';

// CSV to DB column mapping
const COLUMN_MAPPING: Record<string, string> = {
  'No.': 'member_number',
  'Category': 'category',
  'Last Name': 'last_name',
  'First Name': 'first_name',
  'StatsGender': 'gender',
  'Known As': 'known_as',
  'ProvState': 'province',
  'Affiliation': 'affiliation',
  'Occupation': 'occupation',
  'HomePhone': 'home_phone',
  'CellPhone': 'cell_phone',
  'Email': 'email',
  'Web Site': 'website',
  'Link to Web Reel': 'web_reel',
  'Instagram': 'instagram'
};

async function importMembers() {
  try {
    console.log(`\n=== Starting Member Import ===`);
    console.log(`\nReading CSV file: ${CSV_FILE_PATH}`);
    
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`\nError: File does not exist: ${CSV_FILE_PATH}`);
      return;
    }
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(CSV_FILE_PATH);
    
    // Convert from ISO-8859-1 to UTF-8
    const content = iconv.decode(fileBuffer, 'ISO-8859-1');
    
    // Parse CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`\nFound ${records.length} records in CSV file`);
    
    // Connect to database
    if (!process.env.DATABASE_URL) {
      console.error('\nError: DATABASE_URL environment variable is not set');
      return;
    }
    
    console.log('\nConnecting to database...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    // Create table if it doesn't exist
    console.log('\nEnsuring members table exists...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "members" (
        "id" SERIAL PRIMARY KEY,
        "member_number" TEXT,
        "category" TEXT,
        "last_name" TEXT,
        "first_name" TEXT,
        "gender" TEXT,
        "known_as" TEXT,
        "province" TEXT,
        "affiliation" TEXT,
        "occupation" TEXT,
        "home_phone" TEXT,
        "cell_phone" TEXT,
        "email" TEXT,
        "website" TEXT,
        "web_reel" TEXT,
        "instagram" TEXT,
        "is_active" BOOLEAN DEFAULT TRUE,
        "imported_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Show sample record
    if (records.length > 0) {
      console.log('\nSample record from CSV:');
      console.log(records[0]);
      
      // Show mapping example
      console.log('\nMapping example (CSV → Database):');
      for (const [csvCol, dbCol] of Object.entries(COLUMN_MAPPING)) {
        if (records[0][csvCol] !== undefined) {
          console.log(`${csvCol} [${records[0][csvCol]}] → ${dbCol}`);
        }
      }
    }
    
    // Begin transaction
    console.log('\nStarting database transaction...');
    await pool.query('BEGIN');
    
    // Clear existing records (optional - comment out if you want to keep existing records)
    await pool.query('TRUNCATE TABLE members RESTART IDENTITY');
    console.log('Cleared existing records from members table');
    
    // Process each record
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Map CSV columns to database columns
        const insertData: Record<string, any> = {};
        
        for (const [csvCol, dbCol] of Object.entries(COLUMN_MAPPING)) {
          if (record[csvCol] !== undefined) {
            insertData[dbCol] = record[csvCol];
          }
        }
        
        // Skip if no data was mapped
        if (Object.keys(insertData).length === 0) {
          console.warn(`\nWarning: Empty record at row ${i+2}, skipping`);
          continue;
        }
        
        // Build query
        const columns = Object.keys(insertData);
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = Object.values(insertData);
        
        // Insert record
        await pool.query(
          `INSERT INTO members (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
          values
        );
        
        successCount++;
        
        // Show progress
        if (i % 50 === 0 || i === records.length - 1) {
          process.stdout.write(`\rImporting records: ${i+1} of ${records.length}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`\nError importing record at row ${i+2}:`, error);
        console.error('Problem record:', record);
      }
    }
    
    console.log(`\n\nImport summary: ${successCount} successes, ${errorCount} errors`);
    
    // Commit transaction
    await pool.query('COMMIT');
    console.log('\nTransaction committed successfully');
    
    // Count records
    const countResult = await pool.query('SELECT COUNT(*) FROM members');
    console.log(`\nTotal members in database: ${countResult.rows[0].count}`);
    
    await pool.end();
    console.log('\nDatabase connection closed');
    console.log('\n=== Member Import Completed ===\n');
    
  } catch (error) {
    console.error('\nError during import process:', error);
  }
}

// Run the import
importMembers().catch(console.error);