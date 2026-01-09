const { Client } = require('pg');

async function main() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });

  try {
    await local.connect();
    
    console.log('Adding columns to local bank_accounts...');
    
    await local.query(`
      ALTER TABLE bank_accounts 
      ADD COLUMN IF NOT EXISTS balance NUMERIC(18, 2),
      ADD COLUMN IF NOT EXISTS balance_date DATE,
      ADD COLUMN IF NOT EXISTS parsing_scheme_uuid UUID
    `);
    
    console.log('✓ Columns added');
    
    const result = await local.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent columns:');
    result.rows.forEach(r => console.log(`  - ${r.column_name}`));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await local.end();
  }
}

main();
