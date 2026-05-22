const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function test() {
  await client.connect();
  
  // Check rs_waybills_in table columns
  const { rows: cols } = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'rs_waybills_in' 
    ORDER BY ordinal_position
  `);
  console.log('=== rs_waybills_in columns ===');
  cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  
  // Find LUX project
  const { rows: lux } = await client.query(`
    SELECT project_uuid::text, project_index, project_name FROM projects 
    WHERE LOWER(project_name) LIKE '%lux%' OR LOWER(project_index) LIKE '%lux%'
    LIMIT 5
  `);
  console.log('\n=== LUX projects ===');
  lux.forEach(r => console.log(JSON.stringify(r)));
  
  await client.end();
}
test().catch(e => { console.error(e.message); process.exit(1); });
