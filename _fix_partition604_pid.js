const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const n = await p.$executeRawUnsafe(
    "UPDATE bank_transaction_batches SET payment_id = 'NP_27daf5_NJ_5c8b11_PRL022024' WHERE id = 604 AND payment_id IS NULL"
  );
  console.log('Updated rows:', n);

  // Verify
  const row = await p.$queryRawUnsafe(`
    SELECT id, payment_id, counteragent_uuid, partition_amount, nominal_amount
    FROM bank_transaction_batches
    WHERE id = 604
  `);
  console.log('Partition 604 after fix:', JSON.stringify(row, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
