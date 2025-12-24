const { Client } = require('pg');

async function checkProject() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT project_index
    FROM projects
    WHERE project_name = 'UNIX Marselle'
  `);
  
  console.log('UNIX Marselle project_index:');
  console.log(result.rows[0].project_index);
  
  await local.end();
}

checkProject().catch(console.error);
