const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const employees = await p.$queryRawUnsafe(`
    SELECT DISTINCT sa.counteragent_uuid, ca.counteragent 
    FROM salary_accruals sa 
    LEFT JOIN counteragents ca ON sa.counteragent_uuid = ca.counteragent_uuid
    LIMIT 10
  `);

  for (const emp of employees) {
    const uuid = emp.counteragent_uuid;
    const name = (emp.counteragent || 'Unknown').substring(0, 35).padEnd(35);
    
    // Use proper alias to avoid ambiguity with bank_transaction_batches.raw_record_uuid
    const nonBatch = await p.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM (
        SELECT id FROM "GE78BG0000000893486000_BOG_GEL" t1
        WHERE t1.counteragent_uuid = $1::uuid
        AND NOT EXISTS (SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = t1.raw_record_uuid::text)
        UNION ALL
        SELECT id FROM "GE65TB7856036050100002_TBC_GEL" t2
        WHERE t2.counteragent_uuid = $1::uuid
        AND NOT EXISTS (SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = t2.raw_record_uuid::text)
      ) x`, uuid);
    
    const batch = await p.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM (
        SELECT btb.id
        FROM "GE78BG0000000893486000_BOG_GEL" t1
        JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = t1.raw_record_uuid::text
        WHERE btb.counteragent_uuid = $1::uuid
        UNION ALL
        SELECT btb.id
        FROM "GE65TB7856036050100002_TBC_GEL" t2
        JOIN bank_transaction_batches btb ON btb.raw_record_uuid::text = t2.raw_record_uuid::text
        WHERE btb.counteragent_uuid = $1::uuid
      ) x`, uuid);
    
    const total = Number(nonBatch[0].cnt) + Number(batch[0].cnt);
    console.log(`${name} | non-batch: ${String(nonBatch[0].cnt).padStart(4)} | batch: ${String(batch[0].cnt).padStart(4)} | total: ${String(total).padStart(4)}`);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
