const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Get several distinct salary employee counteragents
  const employees = await p.$queryRawUnsafe(`
    SELECT DISTINCT sa.counteragent_uuid, ca.counteragent 
    FROM salary_accruals sa 
    LEFT JOIN counteragents ca ON sa.counteragent_uuid = ca.counteragent_uuid
    LIMIT 10
  `);
  console.log(`Testing ${employees.length} salary employees:\n`);

  for (const emp of employees) {
    const uuid = emp.counteragent_uuid;
    const name = emp.counteragent || 'Unknown';
    
    // Count non-batch bank rows
    const nonBatch = await p.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM (
        SELECT id FROM "GE78BG0000000893486000_BOG_GEL" 
        WHERE counteragent_uuid = $1::uuid
        AND NOT EXISTS (SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = raw_record_uuid::text)
        UNION ALL
        SELECT id FROM "GE65TB7856036050100002_TBC_GEL"
        WHERE counteragent_uuid = $1::uuid
        AND NOT EXISTS (SELECT 1 FROM bank_transaction_batches btb WHERE btb.raw_record_uuid::text = raw_record_uuid::text)
      ) x`, uuid);
    
    // Count batch rows
    const batch = await p.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM bank_transaction_batches WHERE counteragent_uuid = $1::uuid`, uuid);
    
    // Count salary accruals
    const salary = await p.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM salary_accruals WHERE counteragent_uuid = $1::uuid`, uuid);
    
    // Count payments
    const payments = await p.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt FROM payments WHERE counteragent_uuid = $1::uuid AND is_active = true`, uuid);
    
    const totalBank = Number(nonBatch[0].cnt) + Number(batch[0].cnt);
    
    console.log(`${name.substring(0, 40).padEnd(40)} | salary: ${String(salary[0].cnt).padStart(3)} | payments: ${String(payments[0].cnt).padStart(3)} | bank(non-batch): ${String(nonBatch[0].cnt).padStart(4)} | bank(batch): ${String(batch[0].cnt).padStart(4)} | total: ${String(totalBank).padStart(4)}`);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
