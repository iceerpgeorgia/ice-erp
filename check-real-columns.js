const { Client } = require('pg');

async function main() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });

  try {
    await local.connect();
    
    const result = await local.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bank_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('LOCAL bank_accounts columns:');
    result.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await local.end();
  }
}

main();
