// Script to continue importing members from where we left off
import fs from 'fs';
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

// Smaller batch size and shorter timeouts
const BATCH_SIZE = 25;
const DELAY_BETWEEN_BATCHES = 100; // milliseconds

// Helper function to wait between batches
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function continueImport() {
  try {
    console.log('\n==== Continuing Member Import ====\n');
    
    // Check if the CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`Error: File does not exist: ${CSV_FILE_PATH}`);
      return;
    }
    
    // Connect to the database
    if (!process.env.DATABASE_URL) {
      console.error('Error: DATABASE_URL environment variable is not set');
      return;
    }
    
    console.log('Connecting to database...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    try {
      // Read the current state of the database
      const currentMembersResult = await pool.query('SELECT COUNT(*), MAX(CAST(member_number AS INTEGER)) as max_member_number FROM members');
      const currentCount = parseInt(currentMembersResult.rows[0].count || '0');
      
      // Determine the starting point
      console.log(`Database currently contains ${currentCount} member records`);
      
      // Read and parse the CSV file
      console.log(`Reading CSV file: ${CSV_FILE_PATH}`);
      const content = iconv.decode(fs.readFileSync(CSV_FILE_PATH), 'ISO-8859-1');
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      
      console.log(`CSV file contains ${records.length} records`);
      
      if (currentCount >= records.length) {
        console.log('All records appear to have been imported already.');
        console.log(`Database contains ${currentCount} records while CSV has ${records.length} records.`);
        return;
      }
      
      // Continue from the point we left off
      const startIndex = currentCount;
      const recordsToImport = records.slice(startIndex);
      
      console.log(`Will continue import from record ${startIndex + 1} to ${records.length}`);
      console.log(`${recordsToImport.length} records remaining to be imported`);
      
      // Process in batches
      let successCount = 0;
      let errorCount = 0;
      let lastBatchIndex = 0;
      
      for (let i = 0; i < recordsToImport.length; i += BATCH_SIZE) {
        const batchStartTime = Date.now();
        const batchStartIndex = i;
        const batchEndIndex = Math.min(i + BATCH_SIZE, recordsToImport.length);
        const batch = recordsToImport.slice(batchStartIndex, batchEndIndex);
        const overallStartIndex = startIndex + batchStartIndex;
        const overallEndIndex = startIndex + batchEndIndex - 1;
        
        console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(recordsToImport.length / BATCH_SIZE)}`);
        console.log(`Records ${overallStartIndex + 1} to ${overallEndIndex + 1} of ${records.length}`);
        
        // Process each record in the batch
        const batchResults = { success: 0, error: 0 };
        
        for (const record of batch) {
          try {
            // Create mapped data
            const insertData: Record<string, any> = {};
            
            for (const [csvCol, dbCol] of Object.entries(COLUMN_MAPPING)) {
              if (record[csvCol] !== undefined) {
                insertData[dbCol] = record[csvCol];
              }
            }
            
            // Skip if no data mapped
            if (Object.keys(insertData).length === 0) {
              console.warn('Warning: Empty record, skipping');
              continue;
            }
            
            // Build SQL query
            const columns = Object.keys(insertData);
            const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
            const values = Object.values(insertData);
            
            // Insert record
            await pool.query(
              `INSERT INTO members (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
            
            batchResults.success++;
            successCount++;
            lastBatchIndex = overallEndIndex;
          } catch (error) {
            console.error('Error importing record:', error);
            batchResults.error++;
            errorCount++;
          }
        }
        
        // Report batch results
        const batchTime = (Date.now() - batchStartTime) / 1000;
        console.log(`Batch completed in ${batchTime.toFixed(2)}s: ${batchResults.success} successes, ${batchResults.error} errors`);
        console.log(`Total progress: ${successCount + errorCount}/${recordsToImport.length} records processed (${Math.round((successCount + errorCount) / recordsToImport.length * 100)}%)`);
        
        // Add a small delay between batches
        if (batchEndIndex < recordsToImport.length) {
          await delay(DELAY_BETWEEN_BATCHES);
        }
      }
      
      // Print final results
      const finalCountResult = await pool.query('SELECT COUNT(*) FROM members');
      const finalCount = parseInt(finalCountResult.rows[0].count);
      
      console.log('\n==== Import Summary ====');
      console.log(`Started with: ${currentCount} records`);
      console.log(`Imported: ${successCount} records successfully`);
      console.log(`Failed: ${errorCount} records`);
      console.log(`Current database total: ${finalCount} records`);
      console.log(`CSV total: ${records.length} records`);
      
      if (finalCount >= records.length) {
        console.log('\n✅ Import complete! All records have been imported.');
      } else {
        console.log(`\n⚠️ Import incomplete. ${records.length - finalCount} records still need to be imported.`);
        console.log('Run this script again to continue importing.');
      }
      
    } finally {
      // Close the database connection
      await pool.end();
      console.log('\nDatabase connection closed.');
    }
    
  } catch (error) {
    console.error('Unexpected error during import:', error);
  }
}

// Run the import
continueImport().catch(console.error);