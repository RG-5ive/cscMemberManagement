// Script to fix the member user password
import pkg from 'pg';
const { Pool } = pkg;
import { promisify } from 'util';
import crypto from 'crypto';

const scryptAsync = promisify(crypto.scrypt);

// Hash a password using scrypt
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function main() {
  // Connect to the database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get the member user
    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [3] // User ID for RION with email rion.gonzales@GMAIL.COM
    );

    if (userResult.rows.length === 0) {
      console.error('Member user not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`Found member user: ${user.username} (ID: ${user.id}, Email: ${user.email})`);

    // Hash the new password
    const newPassword = process.env.MEMBER_PASSWORD;
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the password
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, user.id]
    );

    console.log(`Password updated successfully for user: ${user.username}`);
    console.log(`New password hash: ${hashedPassword}`);
    console.log(`Member can now log in with email: ${user.email} and password: ${newPassword}`);
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);