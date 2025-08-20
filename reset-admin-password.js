// Reset admin password script
import pg from 'pg';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log("Connecting to database...");
    
    // Get the admin user
    const userRes = await pool.query(
      "SELECT id, username, email, role FROM users WHERE email = $1 AND role = $2",
      ["rion.gonzales@gmail.com", "admin"]
    );
    
    if (userRes.rows.length === 0) {
      console.error("Admin user not found!");
      return;
    }
    
    const user = userRes.rows[0];
    console.log(`Found admin user: ${user.email} (ID: ${user.id})`);
    
    // Reset password
    const newPassword = process.env.ADMIN_PASSWORD;
    const hashedPassword = await hashPassword(newPassword);
    
    // Update the user
    const updateRes = await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email, role",
      [hashedPassword, user.id]
    );
    
    if (updateRes.rows.length > 0) {
      console.log(`Password updated successfully for user ${updateRes.rows[0].email} (ID: ${updateRes.rows[0].id})`);
      console.log(`New credentials: ${updateRes.rows[0].email} / ${newPassword}`);
    } else {
      console.log("Password update failed!");
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    pool.end();
  }
}

main();