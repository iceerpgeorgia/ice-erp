/**
 * Clear counteragent (and cascaded fields) for two specific raw records by UUID.
 * Records: abc4e5f1-6a24-576d-a771-302b1dcf73e9, f2341bb6-2fc1-54ab-b330-48efe17dae51
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const prisma = new PrismaClient();

const TARGET_UUIDS = [
  'abc4e5f1-6a24-576d-a771-302b1dcf73e9',
  'f2341bb6-2fc1-54ab-b330-48efe17dae51',
];

const CLEAR_FIELDS = {
  counteragent_uuid: null,
  counteragent_processed: false,
  payment_id: null,
  project_uuid: null,
  financial_code_uuid: null,
  parsing_lock: false,
  is_processed: false,
};

async function main() {
  // Get all raw table names
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%_BOG_GEL' OR table_name LIKE '%_TBC_GEL')
    ORDER BY table_name
  `);

  for (const uuid of TARGET_UUIDS) {
    let found = false;
    for (const t of tables) {
      const tname = t.table_name;

      const { data: rows, error: fetchErr } = await supabase
        .from(tname)
        .select('id, counteragent_uuid, counteragent_inn, payment_id, is_processed')
        .eq('uuid', uuid)
        .limit(1);

      if (fetchErr || !rows || rows.length === 0) continue;

      found = true;
      const row = rows[0];
      console.log(`\nFound uuid=${uuid} in ${tname}:`);
      console.log(`  id=${row.id}`);
      console.log(`  counteragent_uuid=${row.counteragent_uuid}`);
      console.log(`  counteragent_inn=${row.counteragent_inn}`);
      console.log(`  payment_id=${row.payment_id}`);
      console.log(`  is_processed=${row.is_processed}`);

      const { error: updateErr } = await supabase
        .from(tname)
        .update(CLEAR_FIELDS)
        .eq('id', row.id);

      if (updateErr) {
        console.log(`  ERROR: ${updateErr.message}`);
      } else {
        console.log(`  ✓ Cleared counteragent, payment_id, project, financial_code, parsing_lock`);
      }
      break;
    }

    if (!found) {
      console.log(`\nNOT FOUND: uuid=${uuid} in any raw table`);
    }
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
