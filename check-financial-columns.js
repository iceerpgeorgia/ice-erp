const { Client } = require('pg');

async function checkColumns() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'financial_codes'
    ORDER BY ordinal_position
  `);
  
  console.log('financial_codes columns:');
  result.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
  
  await local.end();
}

checkColumns().catch(console.error);
