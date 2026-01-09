const { Client } = require('pg');

async function addRawTableColumnSupabase() {
  const supabase = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });

  try {
    await supabase.connect();
    
    console.log('Adding raw_table_name column to Supabase bank_accounts...');
    
    await supabase.query(`
      ALTER TABLE bank_accounts 
      ADD COLUMN IF NOT EXISTS raw_table_name VARCHAR(255)
    `);
    
    console.log('✓ Added raw_table_name column to Supabase');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await supabase.end();
  }
}

addRawTableColumnSupabase();
