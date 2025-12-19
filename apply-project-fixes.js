const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function applyFix(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n🔧 Applying fixes to ${dbName}...\n`);
    
    const sql = fs.readFileSync('fix-project-triggers.sql', 'utf8');
    
    // Execute the entire SQL file
    await client.query(sql);
    
    console.log(`✅ Fixes applied to ${dbName}`);
    
    // Test the fix
    const result = await client.query(`
      SELECT project_name, counteragent, project_index
      FROM projects
      WHERE project_uuid = '26a47fbe-6b71-4d89-b27b-4629deea1d34'
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      console.log(`\n📋 Sample project (${dbName}):`);
      console.log(`   Name: ${result.rows[0].project_name}`);
      console.log(`   Counteragent: ${result.rows[0].counteragent}`);
      console.log(`   Index: ${result.rows[0].project_index}`);
    }
    
  } catch (error) {
    console.error(`❌ Error applying fixes to ${dbName}:`, error.message);
  } finally {
    await client.end();
  }
}

async function main() {
  // Load env vars
  require('dotenv').config({ path: '.env.local' });
  
  const localUrl = process.env.DATABASE_URL || 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public';
  const remoteUrl = process.env.REMOTE_DATABASE_URL;
  
  // Apply to local database
  await applyFix(localUrl, 'LOCAL');
  
  // Apply to Supabase
  if (remoteUrl) {
    await applyFix(remoteUrl, 'SUPABASE');
  } else {
    console.log('\n⚠️  REMOTE_DATABASE_URL not found, skipping Supabase');
  }
}

main();
