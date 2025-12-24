const { Client } = require('pg');

async function checkCounterColumns() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'counteragents'
    ORDER BY ordinal_position
  `);
  
  console.log('Counteragents columns:');
  result.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
  
  await local.end();
}

checkCounterColumns().catch(console.error);
