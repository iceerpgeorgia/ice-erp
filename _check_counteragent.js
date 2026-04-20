const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const CA_UUID = '0d51ff0a-c41a-4f01-a8ea-68359f59329d';
const INN = '406198421';
const INN_PADDED = '0406198421';

const tables = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE78BG0000000893486000_BOG_USD',
  'GE78BG0000000893486000_BOG_EUR',
  'GE65TB7856036050100002_TBC_GEL',
  'GE39TB7856036150100001_TBC_USD',
  'GE39TB7856036150100001_TBC_EUR',
  'GE74BG0000000586388146_BOG_USD',
  'GE78BG0000000893486000_BOG_TRY',
  'GE78BG0000000893486000_BOG_CNY',
  'GE78BG0000000893486000_BOG_KZT',
  'GE78BG0000000893486000_BOG_GBP',
  'GE78BG0000000893486000_BOG_AED',
  'GE52TB7856045067800005_TBC_GEL',
  'GE79TB7856045067800004_TBC_GEL',
];

async function run() {
  console.log('=== LOCAL DB ===');
  for (const t of tables) {
    const r1 = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM "${t}" WHERE counteragent_uuid = $1::uuid`, CA_UUID
    );
    const assigned = Number(r1[0].cnt);

    const r2 = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM "${t}" WHERE counteragent_inn IN ($1, $2)`, INN, INN_PADDED
    );
    const innMatch = Number(r2[0].cnt);

    const r3 = await p.$queryRawUnsafe(
      `SELECT COUNT(*) as cnt FROM "${t}" WHERE counteragent_inn IN ($1, $2) AND counteragent_uuid IS NULL`, INN, INN_PADDED
    );
    const innNoUuid = Number(r3[0].cnt);

    if (assigned > 0 || innMatch > 0) {
      console.log(`${t}: assigned=${assigned}, inn_match=${innMatch}, inn_no_uuid=${innNoUuid}`);
    }
  }

  // Also check counteragent_processed flags for INN-matching records
  console.log('\n=== DETAIL: INN-matching records with flags ===');
  for (const t of tables) {
    try {
      const rows = await p.$queryRawUnsafe(
        `SELECT id, counteragent_uuid, counteragent_processed, counteragent_inn, payment_id, parsing_lock
         FROM "${t}" 
         WHERE counteragent_inn IN ($1, $2) 
         LIMIT 10`, INN, INN_PADDED
      );
      if (rows.length > 0) {
        console.log(`\n--- ${t} (${rows.length} sample rows) ---`);
        for (const r of rows) {
          console.log(`  id=${r.id} ca_uuid=${r.counteragent_uuid} ca_proc=${r.counteragent_processed} inn=${r.counteragent_inn} pid=${r.payment_id} lock=${r.parsing_lock}`);
        }
      }
    } catch (e) {
      // table might not have all columns
    }
  }

  await p.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
