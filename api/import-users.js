// API endpoint to import users from CSV data
import pg from 'pg';
import crypto from 'crypto';
import { promisify } from 'util';

const { Pool } = pg;
const scryptAsync = promisify(crypto.scrypt);

// Hash a password using scrypt (same as the app)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

// Sample user data from your CSV
const usersData = [
  { email: 'forbesfilm@gmail.com', password: 'formfa597', firstName: 'Forbes', lastName: 'Andrew', role: 'user' },
  { email: 'westwardproductions@live.com', password: 'galaly569', firstName: 'Galbreath', lastName: 'Alysha', role: 'user' },
  { email: 'rion.gonzales@gmail.com', password: 'gonrio643', firstName: 'Gonzales', lastName: 'Rion', role: 'admin' },
  { email: 'adam@amfilms.ca', password: 'madada294', firstName: 'Madrzyk', lastName: 'Adam', role: 'user' },
  { email: 'christinaienna@gmail.com', password: 'ienchr829', firstName: 'Ienna', lastName: 'Christina', role: 'user' },
  { email: 'cinestir@gmail.com', password: 'wojmar798', firstName: 'Wojtunik', lastName: 'Martin', role: 'user' },
  { email: 'carolynwong50@gmail.com', password: 'woncar830', firstName: 'Wong', lastName: 'Carolyn', role: 'user' },
  { email: 'byron@zero11zero.com', password: 'wonbyr912', firstName: 'Wong', lastName: 'Byron', role: 'user' },
  { email: 'jbenning@me.com', password: 'benjer191', firstName: 'Benning', lastName: 'Jeremy', role: 'admin' },
  { email: 'guynoire@gmail.com', password: 'godguy332', firstName: 'Godfree', lastName: 'Guy', role: 'user' },
  { email: 'luc@lucmontpellier.com', password: 'monluc208', firstName: 'Montpellier', lastName: 'Luc', role: 'admin' },
  { email: 'bigcitylight@mac.com', password: 'lanphi949', firstName: 'Lanyon', lastName: 'Philip', role: 'user' },
  { email: 'bphilipcsc@gmail.com', password: 'phibru841', firstName: 'Philip', lastName: 'Bruno', role: 'user' },
  { email: 'andrepienaar@mac.com', password: 'pieand487', firstName: 'Pienaar', lastName: 'Andre', role: 'user' }
];

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Simple security check
  const { secret } = req.body;
  if (secret !== 'import-users-2024') {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Starting user import...');
    
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    for (const userData of usersData) {
      try {
        // Hash the password
        const hashedPassword = await hashPassword(userData.password);
        
        // Insert user (or update if exists)
        const query = `
          INSERT INTO users (email, password, "firstName", "lastName", role, username, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
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
          hashedPassword,
          userData.firstName,
          userData.lastName,
          userData.role,
          userData.email.split('@')[0], // username from email
        ]);
        
        const user = result.rows[0];
        results.push(`✅ ${user.email} (ID: ${user.id}, Role: ${user.role})`);
        successCount++;
        
      } catch (error) {
        results.push(`❌ ${userData.email}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    
    console.log('User import completed');
    
    res.json({
      success: true,
      message: `User import completed: ${successCount} success, ${errorCount} errors`,
      summary: {
        successful: successCount,
        errors: errorCount,
        totalUsersInDb: parseInt(countResult.rows[0].count)
      },
      results
    });
    
  } catch (error) {
    console.error('User import error:', error);
    res.status(500).json({ 
      error: 'User import failed', 
      details: error.message 
    });
  } finally {
    await pool.end();
  }
} 