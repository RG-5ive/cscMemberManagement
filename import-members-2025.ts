// Script to import members from the new 2025 CSV file with full demographic data
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// CSV file path
const CSV_FILE_PATH = './attached_assets/Members_List_2025.csv';

// Helper function to parse member name (format: "LAST, FIRST")
function parseMemberName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName || !fullName.trim()) {
    return { firstName: '', lastName: '' };
  }
  
  const parts = fullName.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return {
      lastName: parts[0],
      firstName: parts[1]
    };
  }
  
  // If no comma, treat whole thing as last name
  return {
    lastName: fullName.trim(),
    firstName: ''
  };
}

// Helper function to normalize membership level
function normalizeMembershipLevel(level: string): string {
  if (!level || !level.trim()) return '';
  
  const normalized = level.trim().toUpperCase();
  
  // Map variations to standard categories
  const mapping: Record<string, string> = {
    'ASSOCIATE MEMBER': 'Associate',
    'ASSOCIATE': 'Associate',
    'FULL MEMBER': 'Full',
    'FULL': 'Full',
    'STUDENT': 'Student',
    'AFFILIATE': 'Affiliate',
    'COMPANION': 'Companion',
    'LIFE FULL': 'LifeFull',
    'LIFE ASSOCIATE': 'LifeAssociate',
    'LIFE AFFILIATE': 'LifeAffiliate',
    'LIFE COMPANION': 'LifeCompanion',
    'STAFF': 'Staff',
    'HONORARY': 'Honorary'
  };
  
  return mapping[normalized] || level.trim();
}

// Helper function to clean and normalize values
function cleanValue(value: string): string {
  if (!value) return '';
  return value.trim();
}

async function importMembers2025() {
  try {
    console.log('\n=== Starting 2025 Member Import ===\n');
    
    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`Error: File not found: ${CSV_FILE_PATH}`);
      return;
    }
    
    // Read and parse CSV
    console.log(`Reading CSV file: ${CSV_FILE_PATH}`);
    const fileBuffer = fs.readFileSync(CSV_FILE_PATH);
    const content = fileBuffer.toString('utf-8');
    
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`Found ${records.length} records in CSV file\n`);
    
    // Show sample record
    if (records.length > 0) {
      console.log('Sample record from CSV:');
      console.log(records[0]);
      console.log('');
    }
    
    // Connect to database
    if (!process.env.DATABASE_URL) {
      console.error('Error: DATABASE_URL environment variable is not set');
      return;
    }
    
    console.log('Connecting to database...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    try {
      // Begin transaction
      console.log('Starting database transaction...\n');
      await pool.query('BEGIN');
      
      // Clear existing records
      await pool.query('TRUNCATE TABLE members RESTART IDENTITY CASCADE');
      console.log('Cleared existing member records\n');
      
      // Process each record
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          // Parse member name
          const { firstName, lastName } = parseMemberName(record['MEMBERS']);
          
          // Build languages array
          const languages: string[] = [];
          if (record['SPOKEN LANGUAGE 1']) {
            languages.push(cleanValue(record['SPOKEN LANGUAGE 1']));
          }
          if (record['SPOKEN LANGUAGE 2']) {
            languages.push(cleanValue(record['SPOKEN LANGUAGE 2']));
          }
          
          // Prepare insert data
          const memberData = {
            member_number: String(i + 1),
            category: normalizeMembershipLevel(record['MEMBERSHIP LEVEL']),
            last_name: lastName,
            first_name: firstName,
            gender: cleanValue(record['GENDER']),
            lgbtq_status: cleanValue(record['LGBTQ2+']),
            bipoc_status: cleanValue(record['BIPOC']),
            ethnic_background: cleanValue(record['ETHINICITY']),
            province_territory: cleanValue(record['GEOGRAPHIC LOCATION']),
            languages_spoken: languages,
            is_active: true,
            has_portal_access: false,
            imported_at: new Date().toISOString()
          };
          
          // Insert into database
          await pool.query(
            `INSERT INTO members (
              member_number, category, last_name, first_name, gender,
              lgbtq_status, bipoc_status, ethnic_background, province_territory,
              languages_spoken, is_active, has_portal_access, imported_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              memberData.member_number,
              memberData.category,
              memberData.last_name,
              memberData.first_name,
              memberData.gender,
              memberData.lgbtq_status,
              memberData.bipoc_status,
              memberData.ethnic_background,
              memberData.province_territory,
              memberData.languages_spoken,
              memberData.is_active,
              memberData.has_portal_access,
              memberData.imported_at
            ]
          );
          
          successCount++;
          
          if ((i + 1) % 100 === 0) {
            console.log(`Processed ${i + 1} / ${records.length} records...`);
          }
          
        } catch (error) {
          errorCount++;
          console.error(`Error importing record ${i + 1}:`, error);
          console.error('Record data:', record);
        }
      }
      
      // Commit transaction
      await pool.query('COMMIT');
      
      console.log('\n=== Import Complete ===');
      console.log(`Total records processed: ${records.length}`);
      console.log(`Successfully imported: ${successCount}`);
      console.log(`Errors: ${errorCount}`);
      
      // Show summary statistics
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT category) as categories,
          COUNT(DISTINCT gender) as genders,
          COUNT(DISTINCT lgbtq_status) as lgbtq_statuses,
          COUNT(DISTINCT bipoc_status) as bipoc_statuses,
          COUNT(DISTINCT province_territory) as locations
        FROM members
      `);
      
      console.log('\nDatabase Statistics:');
      console.log(result.rows[0]);
      
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Transaction failed, rolling back:', error);
      throw error;
    } finally {
      await pool.end();
      console.log('\nDatabase connection closed.');
    }
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importMembers2025();
