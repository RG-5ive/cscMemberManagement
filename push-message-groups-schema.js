import { db } from './server/db.js';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool } from '@neondatabase/serverless';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('Connecting to database...');
  console.log('Creating/updating message group tables');

  try {
    // Create the "message_groups" table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS message_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_by_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Message groups table created or verified');

    // Create the "message_group_members" table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS message_group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES message_groups(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        added_by_id INTEGER REFERENCES users(id),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Message group members table created or verified');

    // Alter the "messages" table to add the new columns if they don't exist
    // First check if to_group_id column exists
    const toGroupIdExists = await db.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'to_group_id';
    `);

    if (toGroupIdExists.rows.length === 0) {
      await db.execute(`
        ALTER TABLE messages 
        ADD COLUMN to_group_id INTEGER REFERENCES message_groups(id) ON DELETE CASCADE,
        ADD COLUMN filter_criteria JSONB;
      `);
      console.log('Added new columns to messages table');
    } else {
      console.log('New message columns already exist');
    }
    
    // Make the to_user_id column nullable since group messages don't need a to_user_id
    await db.execute(`
      ALTER TABLE messages 
      ALTER COLUMN to_user_id DROP NOT NULL;
    `);
    console.log('Updated message table schema successfully');
    
    console.log('Schema updated successfully!');
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });