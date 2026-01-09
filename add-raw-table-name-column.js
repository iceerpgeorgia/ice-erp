const { Client } = require('pg');

async function addRawTableColumn() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });

  try {
    await local.connect();
    
    console.log('Adding raw_table_name column to bank_accounts...');
    
    await local.query(`
      ALTER TABLE bank_accounts 
      ADD COLUMN IF NOT EXISTS raw_table_name VARCHAR(255)
    `);
    
    console.log('✓ Added raw_table_name column');
    
    // Show updated structure
    const result = await local.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('\nBank accounts columns:');
    result.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await local.end();
  }
}

addRawTableColumn();
