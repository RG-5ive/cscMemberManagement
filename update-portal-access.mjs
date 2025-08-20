import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

async function updatePortalAccessForCompletedOnboarding() {
  try {
    console.log('Updating portal access for users who completed onboarding...');
    
    // Connect to the database
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Find users who have completed onboarding and update their corresponding member records
    const updateQuery = `
      UPDATE members 
      SET has_portal_access = TRUE 
      WHERE LOWER(email) IN (
        SELECT LOWER(email) 
        FROM users 
        WHERE has_completed_onboarding = TRUE
      )
      AND has_portal_access IS NOT TRUE
      RETURNING id, email, first_name, last_name
    `;
    
    const result = await pool.query(updateQuery);
    
    console.log(`Updated portal access for ${result.rows.length} members:`);
    result.rows.forEach(member => {
      console.log(`- ID ${member.id}: ${member.first_name} ${member.last_name} (${member.email})`);
    });
    
    // Also show count of users with completed onboarding
    const onboardingCount = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE has_completed_onboarding = TRUE
    `);
    
    console.log(`\nTotal users with completed onboarding: ${onboardingCount.rows[0].count}`);
    
    await pool.end();
    console.log('Portal access update completed successfully!');
  } catch (error) {
    console.error('Error updating portal access:', error);
    process.exit(1);
  }
}

updatePortalAccessForCompletedOnboarding();