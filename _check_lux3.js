const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function test() {
  await client.connect();
  
  const luxUuid = 'eec3d256-1657-4bbd-b4f6-e7b43062d791';
  
  // What payments does LUX have?
  const { rows: pmts } = await client.query(`
    SELECT fc.code AS fc_code, COUNT(*) as cnt, SUM(p.amount) as total
    FROM payments p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE p.project_uuid = $1 AND p.is_active = true
    GROUP BY fc.code ORDER BY fc.code
  `, [luxUuid]);
  console.log('=== LUX payment FCs ===');
  pmts.forEach(r => console.log(JSON.stringify(r)));
  
  // Does projects table have financial_code_uuid?
  const { rows: projCols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name LIKE '%financial%'
  `);
  console.log('\n=== projects financial columns ===');
  projCols.forEach(r => console.log(r.column_name));
  
  // LUX project details
  const { rows: proj } = await client.query(`
    SELECT * FROM projects WHERE project_uuid = $1
  `, [luxUuid]);
  console.log('\n=== LUX project record ===');
  if (proj[0]) {
    for (const [k, v] of Object.entries(proj[0])) {
      if (v !== null && v !== '' && v !== false) console.log(`  ${k}: ${v}`);
    }
  }
  
  await client.end();
}
test().catch(e => { console.error(e.message); process.exit(1); });
