const { Client } = require('pg');

async function showSamples() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  const result = await local.query(`
    SELECT project_name, project_index
    FROM projects
    WHERE project_index IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 10
  `);
  
  console.log('Sample project_index values:\n');
  result.rows.forEach((row, i) => {
    console.log(`${i + 1}. ${row.project_name}`);
    console.log(`   ${row.project_index}\n`);
  });
  
  // Count separators
  const firstIndex = result.rows[0].project_index;
  const separatorCount = (firstIndex.match(/\|/g) || []).length;
  console.log(`Format verification: ${separatorCount} separators (should be 5)`);
  
  await local.end();
}

showSamples().catch(console.error);
