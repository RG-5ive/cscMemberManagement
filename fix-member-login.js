import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    // Generate a random salt
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Hash the password with the salt using scrypt
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      
      // Return the hashed password in the format: <hash>.<salt>
      resolve(`${derivedKey.toString('hex')}.${salt}`);
    });
  });
}

async function main() {
  try {
    console.log('Connecting to database...');
    
    // The member email and ID we want to update
    const memberEmail = 'rion.gonzales@gmail.com';
    const newPassword = 'Test12u*';
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    console.log(`Generated new password hash for '${newPassword}'`);
    console.log(`Hash length: ${hashedPassword.length}`);
    console.log(`Hash: ${hashedPassword}`);
    
    // Update the user record
    const result = await pool.query(
      `UPDATE users SET password = $1 
       WHERE LOWER(email) = LOWER($2) AND role = 'user'
       RETURNING id, username, email, role`,
      [hashedPassword, memberEmail]
    );
    
    if (result.rows.length === 0) {
      console.log(`No member user found with email ${memberEmail}`);
      return;
    }
    
    const user = result.rows[0];
    console.log(`Updated password for member user:`, {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
    
    console.log('Password updated successfully!');
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the script
main();