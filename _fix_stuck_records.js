/**
 * Repair stuck records - update one at a time to avoid statement timeout.
 * Excludes INN 00000000000 (ხათუნა მესხი).
 */

const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%_BOG_GEL' OR table_name LIKE '%_TBC_GEL')
    ORDER BY table_name
  `);

  let totalFixed = 0;

  for (const t of tables) {
    const tname = t.table_name;

    const { data: stuckRows, error: fetchErr } = await supabase
      .from(tname)
      .select('id, counteragent_inn')
      .eq('counteragent_processed', true)
      .is('counteragent_uuid', null)
      .not('counteragent_inn', 'is', null)
      .neq('counteragent_inn', '')
      .neq('counteragent_inn', '00000000000')
      .neq('counteragent_inn', '0000000000');

    if (fetchErr || !stuckRows || stuckRows.length === 0) continue;

    console.log(`${tname}: ${stuckRows.length} stuck records`);

    let ok = 0, fail = 0;
    for (const row of stuckRows) {
      const { error } = await supabase
        .from(tname)
        .update({
          counteragent_processed: false,
          processing_case: null,
          is_processed: false
        })
        .eq('id', row.id);

      if (error) {
        fail++;
        console.log(`  FAIL id=${row.id}: ${error.message}`);
      } else {
        ok++;
      }
    }
    console.log(`  Updated: ${ok}, Failed: ${fail}`);
    totalFixed += ok;
  }

  console.log(`\nTotal fixed: ${totalFixed}`);

  // Verify
  for (const t of tables) {
    const tname = t.table_name;
    const { count } = await supabase
      .from(tname)
      .select('*', { count: 'exact', head: true })
      .eq('counteragent_processed', true)
      .is('counteragent_uuid', null)
      .not('counteragent_inn', 'is', null)
      .neq('counteragent_inn', '')
      .neq('counteragent_inn', '00000000000')
      .neq('counteragent_inn', '0000000000');

    if (count > 0) {
      console.log(`STILL STUCK in ${tname}: ${count}`);
    }
  }

  console.log('Done.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
/**
 * Repair stuck records where counteragent_processed=true but counteragent_uuid=null.
 * Excludes INN 00000000000 (ხათუნა მესხი) — different case per user.
 */

const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND (table_name LIKE '%_BOG_GEL' OR table_name LIKE '%_TBC_GEL')
    ORDER BY table_name
  `);

  console.log('=== Reset stuck records (excluding INN 00000000000) ===\n');
  let totalFixed = 0;

  for (const t of tables) {
    const tname = t.table_name;

    const { data: stuckRows, error: fetchErr } = await supabase
      .from(tname)
      .select('id, uuid, counteragent_inn')
      .eq('counteragent_processed', true)
      .is('counteragent_uuid', null)
      .not('counteragent_inn', 'is', null)
      .neq('counteragent_inn', '')
      .neq('counteragent_inn', '00000000000')
      .neq('counteragent_inn', '0000000000');

    if (fetchErr) {
      console.log(`  [${tname}] Fetch error: ${fetchErr.message}`);
      continue;
    }

    if (!stuckRows || stuckRows.length === 0) continue;

    console.log(`${tname}: ${stuckRows.length} stuck records`);

    const ids = stuckRows.map(r => r.id);
    const chunkSize = 50;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error: updateErr } = await supabase
        .from(tname)
        .update({
          counteragent_processed: false,
          processing_case: null,
          is_processed: false
        })
        .in('id', chunk);

      if (updateErr) {
        console.log(`  Update error: ${updateErr.message}`);
      }
    }

    totalFixed += stuckRows.length;

    const innCounts = {};
    for (const r of stuckRows) {
      innCounts[r.counteragent_inn] = (innCounts[r.counteragent_inn] || 0) + 1;
    }
    for (const [inn, cnt] of Object.entries(innCounts)) {
      console.log(`  INN ${inn} x ${cnt}`);
    }
  }

  console.log(`\nTotal records reset: ${totalFixed}`);

  // Verify
  console.log('\n=== Verify ===');
  for (const t of tables) {
    const tname = t.table_name;
    const { count } = await supabase
      .from(tname)
      .select('*', { count: 'exact', head: true })
      .eq('counteragent_processed', true)
      .is('counteragent_uuid', null)
      .not('counteragent_inn', 'is', null)
      .neq('counteragent_inn', '')
      .neq('counteragent_inn', '00000000000')
      .neq('counteragent_inn', '0000000000');

    if (count > 0) {
      console.log(`${tname}: STILL ${count} stuck`);
    }
  }

  console.log('\nDone. Records reset to counteragent_processed=false.');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
