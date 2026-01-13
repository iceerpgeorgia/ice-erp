const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function syncSchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const sql = fs.readFileSync('migrations/sync_raw_schema_local.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ LOCAL raw table schema synced with Supabase');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

syncSchema();
