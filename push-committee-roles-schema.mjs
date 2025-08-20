#!/usr/bin/env node

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Connect to the database
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = new Pool({ connectionString: databaseUrl });

console.log('Connected to database, applying schema changes...');

// Define default committee roles
const defaultRoles = [
  {
    name: 'Chair',
    description: 'Committee chairperson with full management capabilities',
    canManageCommittee: true,
    canManageWorkshops: true
  },
  {
    name: 'Co-Chair',
    description: 'Committee co-chairperson with workshop management capabilities',
    canManageCommittee: false,
    canManageWorkshops: true
  },
  {
    name: 'Member',
    description: 'Regular committee member without special management privileges',
    canManageCommittee: false,
    canManageWorkshops: false
  }
];

async function main() {
  try {
    console.log('Adding new columns to users table...');
    
    // Add new columns to the users table
    await client.query(`
      BEGIN;
      
      -- First, update default users to have the correct role values
      UPDATE users SET role = 'user' WHERE role = 'user';
      UPDATE users SET role = 'admin' WHERE role = 'admin';
      
      -- Create committee-related tables without any dependency on enums
      CREATE TABLE IF NOT EXISTS committee_roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        can_manage_committee BOOLEAN NOT NULL DEFAULT FALSE,
        can_manage_workshops BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
      
      -- Create committee_members table
      CREATE TABLE IF NOT EXISTS committee_members (
        id SERIAL PRIMARY KEY,
        committee_id INTEGER NOT NULL REFERENCES committees(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        member_id INTEGER REFERENCES members(id),
        role_id INTEGER NOT NULL REFERENCES committee_roles(id),
        added_by_id INTEGER REFERENCES users(id),
        start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        end_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
      
      -- Add committee management permissions columns to users
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS can_manage_committees BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_manage_workshops BOOLEAN NOT NULL DEFAULT FALSE;
      
      COMMIT;
    `);
    
    console.log('Schema updated successfully. Adding default committee roles...');
    
    // Insert default roles if they don't exist
    for (const role of defaultRoles) {
      const { rowCount } = await client.query(`
        INSERT INTO committee_roles 
        (name, description, can_manage_committee, can_manage_workshops)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
        RETURNING id
      `, [role.name, role.description, role.canManageCommittee, role.canManageWorkshops]);
      
      if (rowCount > 0) {
        console.log(`Added role: ${role.name}`);
      } else {
        console.log(`Role already exists: ${role.name}`);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();