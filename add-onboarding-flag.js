// Add onboarding flag to users table
import pg from 'pg';
const { Pool } = pg;

async function main() {
  try {
    console.log('Adding onboarding completion flag to users table...');
    
    // Connect to the database
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Check if column already exists
    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'has_completed_onboarding'
    `);
    
    // Only add the column if it doesn't exist
    if (checkRes.rows.length === 0) {
      console.log('Column does not exist, adding it now...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE
      `);
      console.log('Column added successfully!');
    } else {
      console.log('Column already exists, no changes needed.');
    }
    
    // Check for users who may have completed onboarding (have demographic data filled)
    const updateRes = await pool.query(`
      UPDATE users
      SET has_completed_onboarding = TRUE
      WHERE 
        (gender IS NOT NULL AND gender != '') OR
        (lgbtq2_status IS NOT NULL AND lgbtq2_status != '') OR
        (bipoc_status IS NOT NULL AND bipoc_status != '') OR
        (ethnicity IS NOT NULL AND array_length(ethnicity, 1) > 0) OR
        (location IS NOT NULL AND location != '') OR
        (languages IS NOT NULL AND array_length(languages, 1) > 0)
      RETURNING id, username, email
    `);
    
    console.log(`Updated ${updateRes.rows.length} users who likely completed onboarding:`);
    updateRes.rows.forEach(user => {
      console.log(`- ID ${user.id}: ${user.username} (${user.email})`);
    });
    
    await pool.end();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();