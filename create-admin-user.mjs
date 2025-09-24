import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function main() {
  try {
    console.log('Creating admin user...');
    
    // Connect to the database
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Get admin credentials from environment variables
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      console.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
      process.exit(1);
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(adminPassword);
    
    // Check if admin user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (existingUser.rows.length > 0) {
      console.log('Admin user already exists, updating password...');
      // Update existing user
      await pool.query(`
        UPDATE users 
        SET password = $1 
        WHERE email = $2
      `, [hashedPassword, adminEmail]);
      console.log('Admin password updated');
    } else {
      console.log('Creating new admin user...');
      // Create new admin user
      await pool.query(`
        INSERT INTO users (username, email, password, role, can_manage_committees, can_manage_workshops, has_completed_onboarding)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['admin', adminEmail, hashedPassword, 'admin', true, true, true]);
      console.log('Admin user created successfully');
    }
    
    await pool.end();
    console.log('Admin user setup completed');
  } catch (error) {
    console.error('Error setting up admin user:', error);
    process.exit(1);
  }
}

main();