const { Client } = require('pg');

async function checkTwinData() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT 
      project_name,
      financial_code_uuid,
      counteragent_uuid,
      value,
      date
    FROM projects 
    WHERE project_name LIKE '%TWIN%'
    LIMIT 1
  `);
  
  console.log('TWIN TOWER project data:');
  console.log(JSON.stringify(result.rows[0], null, 2));
  
  await local.end();
}

checkTwinData().catch(console.error);
