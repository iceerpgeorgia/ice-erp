const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const n = await p.$executeRawUnsafe(
    `UPDATE bank_transaction_batches
     SET counteragent_uuid = $1::uuid
     WHERE id = 604 AND counteragent_uuid IS NULL`,
    'c247edba-fd51-4a47-8765-f7ea1a0a9459'
  );
  console.log('Rows updated:', n);

  // Verify
  const rows = await p.$queryRawUnsafe(
    `SELECT id, batch_id, counteragent_uuid, payment_id, partition_amount FROM bank_transaction_batches WHERE batch_id = 'BTC_B6C551_22_68554D' ORDER BY id`
  );
  console.log('After fix:', JSON.stringify(rows, (k,v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

main().catch(console.error).finally(() => p.$disconnect());
