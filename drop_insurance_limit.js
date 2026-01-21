const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function dropColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔗 Connecting to Supabase...');
    
    const sql = fs.readFileSync('drop_insurance_limit.sql', 'utf8');
    
    console.log('🗑️  Dropping insurance_limit column from salary_accruals...');
    await pool.query(sql);
    
    console.log('✅ Column dropped successfully from Supabase!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

dropColumn();
