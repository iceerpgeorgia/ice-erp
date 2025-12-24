const { Client } = require('pg');

async function checkTwinCountera() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT 
      p.project_name,
      p.counteragent_uuid,
      c.name as counteragent_name
    FROM projects p
    LEFT JOIN counteragents c ON p.counteragent_uuid = c.counteragent_uuid
    WHERE p.project_name = 'TWIN TOWER'
  `);
  
  console.log('TWIN TOWER counteragent:');
  console.log(JSON.stringify(result.rows[0], null, 2));
  
  await local.end();
}

checkTwinCountera().catch(console.error);
