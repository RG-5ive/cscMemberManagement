// Simplified script to import members from CSV in batches
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// CSV file path
const CSV_FILE_PATH = './attached_assets/Members List Cttee.2.csv';

// CSV to DB column mapping (CSV column name → DB column name)
const COLUMN_MAPPING = {
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

// Batch size for processing records
const BATCH_SIZE = 50;

async function setupDatabase(pool) {
  // Create table if it doesn't exist
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
  
  // Get current count
  const result = await pool.query('SELECT COUNT(*) FROM members');
  const currentCount = parseInt(result.rows[0].count);
  
  return currentCount;
}

async function clearTable(pool) {
  await pool.query('TRUNCATE TABLE members RESTART IDENTITY');
  console.log('Cleared existing records from members table');
}

async function importBatch(pool, records, startIndex, batchSize) {
  const endIndex = Math.min(startIndex + batchSize, records.length);
  const batch = records.slice(startIndex, endIndex);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const record of batch) {
    try {
      // Map CSV columns to database columns
      const insertData = {};
      for (const [csvCol, dbCol] of Object.entries(COLUMN_MAPPING)) {
        if (record[csvCol] !== undefined) {
          insertData[dbCol] = record[csvCol];
        }
      }
      
      // Skip if no data was mapped
      if (Object.keys(insertData).length === 0) {
        continue;
      }
      
      // Build query
      const columns = Object.keys(insertData);
      const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
      const values = Object.values(insertData);
      
      // Insert record
      await pool.query(
        `INSERT INTO members (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );
      
      successCount++;
    } catch (error) {
      errorCount++;
      console.error(`Error importing record:`, error.message);
    }
  }
  
  return { successCount, errorCount, processedCount: endIndex - startIndex };
}

async function importMembers() {
  try {
    console.log(`\n=== Starting Member Import ===`);
    console.log(`\nReading CSV file: ${CSV_FILE_PATH}`);
    
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`\nError: File does not exist: ${CSV_FILE_PATH}`);
      return;
    }
    
    // Read file as buffer and convert from ISO-8859-1 to UTF-8
    const content = iconv.decode(fs.readFileSync(CSV_FILE_PATH), 'ISO-8859-1');
    
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
    
    try {
      // Setup database
      console.log('\nSetting up database table...');
      const currentCount = await setupDatabase(pool);
      console.log(`Current member count in database: ${currentCount}`);
      
      // Ask if we should clear existing data
      console.log('\nClearing existing data...');
      await clearTable(pool);
      
      // Process in batches
      console.log(`\nImporting data in batches of ${BATCH_SIZE}...`);
      let totalSuccess = 0;
      let totalErrors = 0;
      
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(records.length / BATCH_SIZE);
        
        console.log(`\nProcessing batch ${batchNumber} of ${totalBatches} (records ${i+1}-${Math.min(i+BATCH_SIZE, records.length)})`);
        
        const { successCount, errorCount, processedCount } = 
          await importBatch(pool, records, i, BATCH_SIZE);
        
        totalSuccess += successCount;
        totalErrors += errorCount;
        
        console.log(`Batch results: ${successCount} successes, ${errorCount} errors out of ${processedCount} processed`);
      }
      
      // Final count
      const finalResult = await pool.query('SELECT COUNT(*) FROM members');
      const finalCount = parseInt(finalResult.rows[0].count);
      
      console.log(`\n=== Import Summary ===`);
      console.log(`Total records processed: ${records.length}`);
      console.log(`Successfully imported: ${totalSuccess}`);
      console.log(`Failed to import: ${totalErrors}`);
      console.log(`Current records in database: ${finalCount}`);
      
    } finally {
      // Close pool in finally block to ensure it happens even if errors occur
      await pool.end();
      console.log('\nDatabase connection closed');
    }
    
    console.log('\n=== Member Import Completed ===\n');
    
  } catch (error) {
    console.error('\nError during import process:', error);
  }
}

// Run the import
importMembers().catch(console.error);