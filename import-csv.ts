import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { Pool } from 'pg';

// Update these settings based on your CSV file and database table
const CSV_FILE_PATH = './data.csv'; // Change this to your CSV file path
const TARGET_TABLE = 'users'; // Change this to the table where you want to import data
// Define which columns from your CSV should map to which database columns
const COLUMN_MAPPING: Record<string, string> = {
  // CSV column name -> Database column name
  // Example: 'email_address': 'email',
  // Add your mappings here based on your CSV structure
};

async function importCsv() {
  console.log(`Starting CSV import from ${CSV_FILE_PATH} to ${TARGET_TABLE} table...`);
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  // Make sure the CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`File not found: ${CSV_FILE_PATH}`);
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    const fileContent = fs.readFileSync(CSV_FILE_PATH, { encoding: 'utf-8' });
    
    // Parse the CSV file
    parse(fileContent, {
      columns: true, // Use the first line as column names
      skip_empty_lines: true,
      trim: true
    }, async (err, records) => {
      if (err) {
        console.error('Error parsing CSV:', err);
        await pool.end();
        return;
      }
      
      console.log(`Found ${records.length} records in CSV file`);
      
      // First record to understand the structure
      if (records.length > 0) {
        console.log('Sample record:');
        console.log(records[0]);
      }
      
      // If no column mapping is provided, we'll try to use direct column names
      const hasMapping = Object.keys(COLUMN_MAPPING).length > 0;
      
      try {
        // Begin transaction
        await pool.query('BEGIN');
        
        // Process each record
        for (const record of records) {
          // Build the insertion data
          let insertData: Record<string, any> = {};
          
          if (hasMapping) {
            // Use the mapping to convert CSV columns to DB columns
            for (const [csvCol, dbCol] of Object.entries(COLUMN_MAPPING)) {
              if (record[csvCol] !== undefined) {
                insertData[dbCol] = record[csvCol];
              }
            }
          } else {
            // Directly use CSV columns (assuming they match DB columns)
            insertData = { ...record };
          }
          
          // Skip empty records
          if (Object.keys(insertData).length === 0) {
            console.warn('Empty record found, skipping');
            continue;
          }
          
          // Build the SQL query
          const columns = Object.keys(insertData);
          const values = Object.values(insertData);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          
          const query = {
            text: `INSERT INTO "${TARGET_TABLE}" (${columns.map(c => `"${c}"`).join(', ')}) 
                   VALUES (${placeholders})
                   ON CONFLICT DO NOTHING`, // Add appropriate conflict handling
            values: values
          };
          
          try {
            await pool.query(query);
          } catch (error) {
            console.error('Error inserting record:', error);
            console.error('Failed record:', record);
            throw error; // Rethrow to trigger rollback
          }
        }
        
        // Commit transaction
        await pool.query('COMMIT');
        console.log(`Successfully imported ${records.length} records to ${TARGET_TABLE}`);
        
      } catch (error) {
        // Rollback on error
        await pool.query('ROLLBACK');
        console.error('Transaction failed, changes rolled back');
        console.error(error);
      } finally {
        await pool.end();
        console.log('Database connection closed');
      }
    });
    
  } catch (error) {
    console.error('Error reading or processing CSV file:', error);
    await pool.end();
  }
}

importCsv().catch(console.error);