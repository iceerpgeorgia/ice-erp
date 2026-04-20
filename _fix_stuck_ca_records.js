// Direct SQL fix for the 2 stuck records in both local + Supabase
// Records in GE78BG0000000893486000_BOG_GEL with INN 406198421 but no counteragent_uuid
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const CA_UUID = '0d51ff0a-c41a-4f01-a8ea-68359f59329d';
const INN = '406198421';
const TABLE = 'GE78BG0000000893486000_BOG_GEL';

async function run() {
  const p = new PrismaClient();
  const supaPool = new Pool({ connectionString: process.env.REMOTE_DATABASE_URL });

  // Fix local DB
  console.log('=== Fixing local DB ===');
  const localResult = await p.$queryRawUnsafe(
    `UPDATE "${TABLE}" SET 
       counteragent_uuid = $1::uuid,
       counteragent_processed = true,
       updated_at = NOW()
     WHERE counteragent_inn = $2 
       AND counteragent_uuid IS NULL
     RETURNING id`,
    CA_UUID, INN
  );
  console.log(`Updated ${localResult.length} rows in local DB:`, localResult.map(r => r.id).join(', '));

  // Fix Supabase
  console.log('\n=== Fixing Supabase ===');
  const supaResult = await supaPool.query(
    `UPDATE "${TABLE}" SET 
       counteragent_uuid = $1::uuid,
       counteragent_processed = true,
       updated_at = NOW()
     WHERE counteragent_inn = $2 
       AND counteragent_uuid IS NULL
     RETURNING id`,
    [CA_UUID, INN]
  );
  console.log(`Updated ${supaResult.rowCount} rows in Supabase:`, supaResult.rows.map(r => r.id).join(', '));

  // Verify
  console.log('\n=== Verification ===');
  const verify = await p.$queryRawUnsafe(
    `SELECT id, counteragent_uuid, counteragent_processed, payment_id 
     FROM "${TABLE}" WHERE counteragent_inn = $1`, INN
  );
  for (const r of verify) {
    console.log(`  id=${r.id} ca_uuid=${r.counteragent_uuid} ca_proc=${r.counteragent_processed} pid=${r.payment_id}`);
  }

  await p.$disconnect();
  await supaPool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
