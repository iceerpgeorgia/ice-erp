const { Client } = require('pg');

async function checkTables() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%financial%'
    ORDER BY table_name
  `);
  
  console.log('Tables with "financial" in name:');
  result.rows.forEach(row => console.log(`- ${row.table_name}`));
  
  await local.end();
}

checkTables().catch(console.error);
