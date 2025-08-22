// Script to import users with email/password from CSV
import fs from 'fs';
import { parse } from 'csv-parse';
import pkg from 'pg';
const { Pool } = pkg;
import { promisify } from 'util';
import crypto from 'crypto';

const scryptAsync = promisify(crypto.scrypt);

// Update this path to your CSV file
const CSV_FILE_PATH = './users.csv'; // Put your CSV file here

// Hash a password using scrypt (same as the app)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function importUsers() {
  console.log(`Starting user import from ${CSV_FILE_PATH}...`);
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  // Make sure the CSV file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`File not found: ${CSV_FILE_PATH}`);
    console.log('Expected CSV format:');
    console.log('email,password,firstName,lastName,role');
    console.log('user1@example.com,password123,John,Doe,user');
    console.log('admin@example.com,adminpass,Admin,User,admin');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    const fileContent = fs.readFileSync(CSV_FILE_PATH, { encoding: 'utf-8' });
    
    // Parse the CSV file
    const records = await new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true, // Use the first line as column names
        skip_empty_lines: true,
        trim: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    
    console.log(`Found ${records.length} users in CSV file`);
    
    // Show sample record to verify format
    if (records.length > 0) {
      console.log('Sample record:', records[0]);
      
      // Validate required columns
      const required = ['email', 'password'];
      const columns = Object.keys(records[0]);
      const missing = required.filter(col => !columns.includes(col));
      
      if (missing.length > 0) {
        console.error(`Missing required columns: ${missing.join(', ')}`);
        console.log(`Available columns: ${columns.join(', ')}`);
        console.log('Expected CSV format: email,password,firstName,lastName,role');
        return;
      }
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    try {
      // Begin transaction
      await pool.query('BEGIN');
      
      // Process each record
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          // Validate email
          if (!record.email || !record.email.includes('@')) {
            console.warn(`Row ${i+2}: Invalid email '${record.email}', skipping`);
            errorCount++;
            continue;
          }
          
          // Validate password
          if (!record.password || record.password.length < 3) {
            console.warn(`Row ${i+2}: Invalid password for ${record.email}, skipping`);
            errorCount++;
            continue;
          }
          
          // Hash the password
          const hashedPassword = await hashPassword(record.password);
          
          // Prepare user data
          const userData = {
            email: record.email.toLowerCase().trim(),
            password: hashedPassword,
            firstName: record.firstName || 'User',
            lastName: record.lastName || 'Name',
            role: record.role || 'user',
            username: record.username || record.email.split('@')[0],
            createdAt: new Date()
          };
          
          // Insert user (or update if exists)
          const query = `
            INSERT INTO users (email, password, "firstName", "lastName", role, username, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) 
            DO UPDATE SET 
              password = EXCLUDED.password,
              "firstName" = EXCLUDED."firstName",
              "lastName" = EXCLUDED."lastName",
              role = EXCLUDED.role,
              username = EXCLUDED.username
            RETURNING id, email, role
          `;
          
          const result = await pool.query(query, [
            userData.email,
            userData.password,
            userData.firstName,
            userData.lastName,
            userData.role,
            userData.username,
            userData.createdAt
          ]);
          
          const user = result.rows[0];
          console.log(`✅ Row ${i+2}: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
          successCount++;
          
        } catch (error) {
          console.error(`❌ Row ${i+2}: Error importing ${record.email}:`, error.message);
          errorCount++;
        }
      }
      
      // Commit transaction
      await pool.query('COMMIT');
      console.log(`\n🎉 Import completed!`);
      console.log(`✅ Success: ${successCount} users`);
      console.log(`❌ Errors: ${errorCount} users`);
      
      // Show total count
      const countResult = await pool.query('SELECT COUNT(*) FROM users');
      console.log(`📊 Total users in database: ${countResult.rows[0].count}`);
      
    } catch (error) {
      // Rollback on error
      await pool.query('ROLLBACK');
      console.error('Transaction failed, changes rolled back');
      throw error;
    }
    
  } catch (error) {
    console.error('Error during import:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

importUsers().catch(console.error); 