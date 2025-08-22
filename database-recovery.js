#!/usr/bin/env node

/**
 * Database Recovery Script
 * Safely tests and fixes database connection issues
 */

import { Client } from 'pg';

async function testConnection(connectionString, description) {
  console.log(`\n🔍 Testing ${description}...`);
  console.log(`Connection: ${connectionString.replace(/:([^:@]*?)@/, ':***@')}`);
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log(`✅ ${description} - Connection successful!`);
    
    // Test basic query
    const result = await client.query('SELECT current_user, current_database(), version()');
    console.log(`   User: ${result.rows[0].current_user}`);
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    
    await client.end();
    return true;
  } catch (error) {
    console.log(`❌ ${description} - Connection failed:`);
    console.log(`   Error: ${error.message}`);
    if (client._connected) {
      await client.end();
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Database Connection Recovery Tool\n');
  
  // Get environment variables
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT;
  const pgUser = process.env.PGUSER;
  const pgPassword = process.env.PGPASSWORD;
  const pgDatabase = process.env.PGDATABASE;
  const databaseUrl = process.env.DATABASE_URL;
  
  console.log('📋 Current Environment Variables:');
  console.log(`   PGHOST: ${pgHost}`);
  console.log(`   PGPORT: ${pgPort}`);
  console.log(`   PGUSER: ${pgUser}`);
  console.log(`   PGDATABASE: ${pgDatabase}`);
  console.log(`   PGPASSWORD: ${pgPassword ? '[SET]' : '[NOT SET]'}`);
  console.log(`   DATABASE_URL: ${databaseUrl ? databaseUrl.replace(/:([^:@]*?)@/, ':***@') : '[NOT SET]'}`);
  
  // Test current DATABASE_URL
  if (databaseUrl) {
    await testConnection(databaseUrl, 'Current DATABASE_URL');
  }
  
  // Construct correct DATABASE_URL from components
  if (pgHost && pgPort && pgUser && pgPassword && pgDatabase) {
    const constructedUrl = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}?sslmode=require`;
    const success = await testConnection(constructedUrl, 'Constructed from components');
    
    if (success) {
      console.log('\n🎉 SUCCESS! Use this DATABASE_URL in your Replit Secrets:');
      console.log(`\nDATABASE_URL = ${constructedUrl.replace(/:([^:@]*?)@/, ':***@')}`);
      console.log('\n📝 Steps to fix:');
      console.log('1. Copy the working DATABASE_URL above');
      console.log('2. Go to Replit Secrets panel');
      console.log('3. Update DATABASE_URL with the correct format');
      console.log('4. Restart your application');
    }
  }
  
  // Test individual component connection
  if (pgHost && pgPort && pgUser && pgPassword && pgDatabase) {
    console.log('\n🔧 Testing individual components...');
    const client = new Client({
      host: pgHost,
      port: pgPort,
      user: pgUser,
      password: pgPassword,
      database: pgDatabase,
      ssl: { rejectUnauthorized: false }
    });
    
    await testConnection(client.connectionParameters.connectionString, 'Individual components');
  }
  
  console.log('\n✨ Recovery script completed.');
}

main().catch(console.error);