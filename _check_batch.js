const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const BATCH_ID = 'BTC_B6C551_22_68554D';

async function main() {
  // Get all partitions
  const partitions = await p.$queryRawUnsafe(`
    SELECT 
      btb.id,
      btb.batch_id,
      btb.payment_id,
      btb.payment_uuid,
      btb.partition_amount,
      btb.nominal_amount,
      btb.counteragent_uuid,
      btb.project_uuid,
      btb.financial_code_uuid,
      btb.raw_record_uuid,
      ca.counteragent as ca_name
    FROM bank_transaction_batches btb
    LEFT JOIN counteragents ca ON btb.counteragent_uuid = ca.counteragent_uuid
    WHERE btb.batch_id = $1
    ORDER BY btb.id
  `, BATCH_ID);

  console.log('=== BATCH PARTITIONS ===');
  console.log(JSON.stringify(partitions, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));

  // For each partition, get raw record state
  if (partitions.length > 0) {
    const rawUuids = [...new Set(partitions.map(r => r.raw_record_uuid).filter(Boolean))];
    console.log('\n=== UNIQUE RAW RECORD UUIDs ===', rawUuids);

    for (const uuid of rawUuids) {
      // Try BOG table
      const bog = await p.$queryRawUnsafe(`
        SELECT id, uuid, counteragent_uuid, payment_id, counteragent_processed, payment_id_processed, parsing_lock
        FROM "GE78BG0000000893486000_BOG_GEL"
        WHERE raw_record_uuid::text = $1
        LIMIT 1
      `, uuid).catch(() => []);
      if (bog.length) {
        console.log('\n=== RAW RECORD (BOG) ===');
        console.log(JSON.stringify(bog[0], (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
      }

      // Try TBC table
      const tbc = await p.$queryRawUnsafe(`
        SELECT id, uuid, counteragent_uuid, payment_id, parsing_lock
        FROM "GE65TB7856036050100002_TBC_GEL"
        WHERE raw_record_uuid::text = $1
        LIMIT 1
      `, uuid).catch(() => []);
      if (tbc.length) {
        console.log('\n=== RAW RECORD (TBC) ===');
        console.log(JSON.stringify(tbc[0], (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
      }
    }
  }

  // Get consolidated_bank_accounts rows for these raw uuids
  if (partitions.length > 0) {
    const rawUuids = [...new Set(partitions.map(r => r.raw_record_uuid).filter(Boolean))];
    for (const uuid of rawUuids) {
      const cba = await p.$queryRawUnsafe(`
        SELECT id, uuid, counteragent_uuid, payment_id
        FROM consolidated_bank_accounts
        WHERE raw_record_uuid::text = $1
        LIMIT 5
      `, uuid).catch(() => []);
      if (cba.length) {
        console.log('\n=== CONSOLIDATED_BANK_ACCOUNTS ===');
        console.log(JSON.stringify(cba, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
      }
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
