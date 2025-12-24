const { Client } = require('pg');

async function checkSupa() {
  const client = new Client({
    connectionString: 'postgresql://postgres.iceerpgeorgia:fulebimojviT1985%25@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
  });
  
  await client.connect();
  
  const result = await client.query(`
    SELECT project_index
    FROM projects
    WHERE project_name = 'UNIX Marselle'
  `);
  
  console.log('SUPABASE - UNIX Marselle project_index:');
  console.log(result.rows[0].project_index);
  
  await client.end();
}

checkSupa().catch(console.error);
