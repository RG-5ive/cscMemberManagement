// Script to fix the member user password and handle case sensitivity
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
    // Get all user records with this email (case insensitive)
    const userResult = await pool.query(
      "SELECT id, username, email, role FROM users WHERE email ILIKE $1",
      ['%rion.gonzales@gmail.com%']
    );

    if (userResult.rows.length === 0) {
      console.error('No users found with this email pattern');
      return;
    }

    // Hash the new password once
    const newPassword = process.env.MEMBER_PASSWORD;
    const hashedPassword = await hashPassword(newPassword);
    
    // Update each user
    for (const user of userResult.rows) {
      if (user.role === 'user') {
        // Only update users with 'user' role, not 'admin'
        await pool.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [hashedPassword, user.id]
        );
        console.log(`Password updated for ${user.role} user: ${user.username} (ID: ${user.id}, Email: ${user.email})`);
      } else {
        console.log(`Skipping admin user: ${user.username} (ID: ${user.id}, Email: ${user.email})`);
      }
    }

    console.log(`Member users can now log in with email: rion.gonzales@gmail.com and password: ${newPassword}`);
    console.log(`Note: Login is now case-insensitive for the email address`);
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);