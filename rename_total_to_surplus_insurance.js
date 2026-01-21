const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function renameColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔗 Connecting to Supabase...');
    
    const sql = fs.readFileSync('rename_total_to_surplus_insurance.sql', 'utf8');
    
    console.log('🔄 Renaming total_insurance to surplus_insurance...');
    await pool.query(sql);
    
    console.log('✅ Column renamed successfully in Supabase!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

renameColumn();
