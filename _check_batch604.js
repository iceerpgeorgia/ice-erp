const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const accruals = await p.$queryRawUnsafe(`
    SELECT id, payment_id, salary_month::date as salary_month, net_sum
    FROM salary_accruals
    WHERE counteragent_uuid = 'c247edba-fd51-4a47-8765-f7ea1a0a9459'
      AND salary_month BETWEEN '2024-01-01' AND '2024-12-31'
    ORDER BY salary_month
  `);
  console.log('=== 2024 accruals ===');
  for (const a of accruals) {
    console.log(`  id=${a.id} payment_id=${a.payment_id} month=${a.salary_month} net=${a.net_sum}`);
  }

  const parts = await p.$queryRawUnsafe(`
    SELECT id, payment_id, payment_uuid, counteragent_uuid, partition_amount, nominal_amount, raw_record_uuid
    FROM bank_transaction_batches
    WHERE batch_id = 'BTC_B6C551_22_68554D'
    ORDER BY id
  `);
  console.log('\n=== Batch BTC_B6C551_22_68554D partitions ===');
  for (const pt of parts) {
    console.log(`  id=${pt.id} payment_id=${pt.payment_id} counteragent=${pt.counteragent_uuid} partition_amount=${pt.partition_amount} nominal_amount=${pt.nominal_amount}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
