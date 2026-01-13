const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function addCountergentAccountColumn() {
  const client = await pool.connect();
  
  try {
    console.log('Adding counteragent_account_number column to consolidated_bank_accounts...');
    
    await client.query(`
      ALTER TABLE consolidated_bank_accounts
      ADD COLUMN IF NOT EXISTS counteragent_account_number TEXT;
    `);
    
    console.log('✅ Column added successfully!');
    
    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'consolidated_bank_accounts' 
      AND column_name = 'counteragent_account_number';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: counteragent_account_number column exists');
      console.log('   Type:', result.rows[0].data_type);
    } else {
      console.error('❌ Column was not created');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addCountergentAccountColumn();
