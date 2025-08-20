// Script to fix member username and email consistency
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
    console.log("Starting member account fix...");
    
    // Find the member user with ID 3
    const userQuery = `
      SELECT id, username, email, role, password 
      FROM users 
      WHERE id = 3
    `;
    
    const userResult = await pool.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.error('No user found with ID 3');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`Found member user: ${user.username} (ID: ${user.id}, Email: ${user.email})`);
    
    // Normalize the email to lowercase
    const normalizedEmail = 'rion.gonzales@gmail.com';
    
    // Ensure the username is correct and consistent
    const normalizedUsername = 'rion.gonzales';
    
    // Set a new password
    const plainPassword = 'Test12u*';
    const hashedPassword = await hashPassword(plainPassword);
    
    console.log(`Updating member user with:`);
    console.log(`- Email: ${normalizedEmail}`);
    console.log(`- Username: ${normalizedUsername}`);
    console.log(`- New password hash: ${hashedPassword.substring(0, 15)}...`);
    
    // Update the user
    await pool.query(
      'UPDATE users SET email = $1, username = $2, password = $3 WHERE id = $4',
      [normalizedEmail, normalizedUsername, hashedPassword, user.id]
    );
    
    console.log(`Member user updated successfully.`);
    console.log(`User can now log in with email: ${normalizedEmail} and password: ${plainPassword}`);
    
    // Verify the hash works
    const [hashed, salt] = hashedPassword.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const testBuf = await scryptAsync(plainPassword, salt, 64);
    
    if (timingSafeEqual(hashedBuf, testBuf)) {
      console.log("✅ Password hash verification successful");
    } else {
      console.log("❌ Password hash verification failed");
    }
    
    // Check admin account is still using the right email too
    const adminQuery = `
      SELECT id, username, email, role, password 
      FROM users 
      WHERE id = 1
    `;
    
    const adminResult = await pool.query(adminQuery);
    const admin = adminResult.rows[0];
    console.log(`\nAdmin account check:`);
    console.log(`- ID: ${admin.id}`);
    console.log(`- Username: ${admin.username}`);
    console.log(`- Email: ${admin.email}`);
    console.log(`- Role: ${admin.role}`);
    
  } catch (error) {
    console.error('Error updating member account:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);