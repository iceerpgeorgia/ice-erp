const { Client } = require('pg');

async function listTables() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  
  console.log('All tables:');
  result.rows.forEach(row => console.log(`- ${row.table_name}`));
  
  await local.end();
}

listTables().catch(console.error);
