// Direct password fixer script using the exact same hashing logic as the server
import pkg from 'pg';
const { Pool } = pkg;
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Use exactly the same hash function as in server/auth.ts
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  // Connect to the database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("Starting password update...");
    
    // First, fetch the user record from the database directly
    console.log("Checking database for user...");
    
    // Get user with email rion.gonzales@gmail.com (case insensitive)
    const userQuery = `
      SELECT id, username, email, role, password
      FROM users 
      WHERE LOWER(email) = LOWER($1) AND role = $2
    `;
    
    const userResult = await pool.query(userQuery, ['rion.gonzales@gmail.com', 'user']);
    
    if (userResult.rows.length === 0) {
      console.error('No member user found with email: rion.gonzales@gmail.com');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`Found member user: ${user.username} (ID: ${user.id}, Email: ${user.email})`);
    console.log(`Current password hash: ${user.password.substring(0, 15)}...`);
    
    // Hash the password with our implementation
    const plainPassword = process.env.MEMBER_PASSWORD;
    
    // First directly log what our hashing function would produce to verify it matches server
    const hashedPassword = await hashPassword(plainPassword);
    console.log(`Generated new hash for '${plainPassword}': ${hashedPassword.substring(0, 15)}...`);
    
    // Update password
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, user.id]
    );
    
    console.log(`Password updated successfully for user: ${user.username}`);
    console.log(`New password hash: ${hashedPassword}`);
    console.log(`User can now log in with email: ${user.email} and password: ${plainPassword}`);
    
    // Verify the hash works
    const [hashed, salt] = hashedPassword.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const testBuf = await scryptAsync(plainPassword, salt, 64);
    
    if (timingSafeEqual(hashedBuf, testBuf)) {
      console.log("✅ Password hash verification successful");
    } else {
      console.log("❌ Password hash verification failed");
    }
    
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);