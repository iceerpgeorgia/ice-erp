const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP' });
  await client.connect();
  
  const result = await client.query(`
    SELECT project_index 
    FROM projects 
    WHERE project_name LIKE '%TWIN TOWER%' 
    LIMIT 1
  `);
  
  if (result.rows.length > 0) {
    console.log('TWIN TOWER project_index:');
    console.log(result.rows[0].project_index);
  }
  
  await client.end();
})();
