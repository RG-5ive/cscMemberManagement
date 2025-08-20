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
    console.log('Fixing admin password...');
    
    // Connect to the database
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Hash the password
    const adminPassword = process.env.ADMIN_PASSWORD;
    const hashedPassword = await hashPassword(adminPassword);
    
    // Update the admin user
    const updateResult = await pool.query(`
      UPDATE users 
      SET password = $1 
      WHERE id = 1 AND role = 'admin'
      RETURNING id, username, email
    `, [hashedPassword]);
    
    if (updateResult.rows.length > 0) {
      const user = updateResult.rows[0];
      console.log(`Admin password updated for ${user.username} (${user.email})`);
    } else {
      console.log('Admin user not found');
    }
    
    await pool.end();
    console.log('Admin password fix completed');
  } catch (error) {
    console.error('Error fixing admin password:', error);
    process.exit(1);
  }
}

main();