const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const CA_UUID = '0d51ff0a-c41a-4f01-a8ea-68359f59329d';
const INN = '406198421';

async function run() {
  // Check Supabase state
  require('dotenv').config({ path: '.env.local' });
  const supaPool = new Pool({ connectionString: process.env.REMOTE_DATABASE_URL });
  
  console.log('=== SUPABASE STATE ===');
  const tables = ['GE78BG0000000893486000_BOG_GEL'];
  for (const t of tables) {
    const r = await supaPool.query(
      `SELECT id, counteragent_uuid, counteragent_processed, counteragent_inn, payment_id, parsing_lock
       FROM "${t}" WHERE counteragent_inn IN ($1, $2) LIMIT 10`,
      [INN, '0' + INN]
    );
    if (r.rows.length > 0) {
      console.log(`\n--- ${t} (${r.rows.length} rows) ---`);
      for (const row of r.rows) {
        console.log(`  id=${row.id} ca_uuid=${row.counteragent_uuid} ca_proc=${row.counteragent_processed} inn=${row.counteragent_inn} pid=${row.payment_id} lock=${row.parsing_lock}`);
      }
    }
  }
  
  // Also check if reparse was ever triggered for this INN
  console.log('\n=== REPARSE CHECK ===');
  const localP = new PrismaClient();
  // Check if counteragent has iban set (needed for reparse matching)
  const ca = await localP.$queryRawUnsafe(
    `SELECT counteragent_uuid, identification_number, iban, name FROM counteragents WHERE counteragent_uuid = $1::uuid`,
    CA_UUID
  );
  console.log('Counteragent:', JSON.stringify(ca[0], null, 2));
  
  await localP.$disconnect();
  await supaPool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
