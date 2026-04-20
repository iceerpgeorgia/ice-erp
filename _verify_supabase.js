require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.REMOTE_DATABASE_URL });
  const r = await pool.query(
    `SELECT id, counteragent_uuid, counteragent_processed, payment_id 
     FROM "GE78BG0000000893486000_BOG_GEL" 
     WHERE counteragent_inn = $1`, ['406198421']
  );
  console.log('Supabase state:');
  for (const row of r.rows) {
    console.log(`  id=${row.id} ca_uuid=${row.counteragent_uuid} ca_proc=${row.counteragent_processed} pid=${row.payment_id}`);
  }
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
