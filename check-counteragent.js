const { Client } = require('pg');

async function checkCounteragent() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT *
    FROM counteragents
    WHERE counteragent_uuid = 'e284e0fd-a2b7-4d93-8e91-006ff0a8a4ce'
  `);
  
  console.log('Counteragent data:');
  console.log(JSON.stringify(result.rows[0], null, 2));
  
  await local.end();
}

checkCounteragent().catch(console.error);
