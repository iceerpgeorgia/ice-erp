const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateSupabaseSchema() {
  const client = await remotePool.connect();
  
  try {
    console.log('🔧 Adding missing columns to Supabase consolidated_bank_accounts...\n');
    
    // Check if columns exist
    const columnsCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'consolidated_bank_accounts'
    `);
    
    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    
    // Add payment_id if missing
    if (!existingColumns.includes('payment_id')) {
      console.log('   Adding payment_id column...');
      await client.query(`
        ALTER TABLE consolidated_bank_accounts
        ADD COLUMN payment_id TEXT
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_consolidated_payment_id
        ON consolidated_bank_accounts(payment_id)
      `);
      console.log('   ✅ payment_id added');
    } else {
      console.log('   ✅ payment_id already exists');
    }
    
    // Add case_description if missing
    if (!existingColumns.includes('case_description')) {
      console.log('   Adding case_description column...');
      await client.query(`
        ALTER TABLE consolidated_bank_accounts
        ADD COLUMN case_description TEXT
      `);
      console.log('   ✅ case_description added');
    } else {
      console.log('   ✅ case_description already exists');
    }
    
    // Add applied_rule_id if missing
    if (!existingColumns.includes('applied_rule_id')) {
      console.log('   Adding applied_rule_id column...');
      await client.query(`
        ALTER TABLE consolidated_bank_accounts
        ADD COLUMN applied_rule_id INTEGER
      `);
      console.log('   ✅ applied_rule_id added');
    } else {
      console.log('   ✅ applied_rule_id already exists');
    }
    
    // Add raw_table_name if missing
    if (!existingColumns.includes('raw_table_name')) {
      console.log('   Adding raw_table_name column...');
      await client.query(`
        ALTER TABLE consolidated_bank_accounts
        ADD COLUMN raw_table_name TEXT
      `);
      console.log('   ✅ raw_table_name added');
    } else {
      console.log('   ✅ raw_table_name already exists');
    }
    
    console.log('\n✅ Schema update complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await remotePool.end();
  }
}

updateSupabaseSchema();
