const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check the 8th record (March 2023)
  const r1 = await p.$queryRawUnsafe(
    `SELECT dockey, payment_id, description FROM "GE78BG0000000893486000_BOG_GEL" WHERE dockey = '16468087698'`
  );
  console.log('8th record (032023):', r1[0] ? { dockey: r1[0].dockey, payment_id: r1[0].payment_id } : 'NOT FOUND');

  // All 8 records current state
  const r2 = await p.$queryRawUnsafe(
    `SELECT dockey, payment_id FROM "GE78BG0000000893486000_BOG_GEL"
     WHERE dockey IN ('16468086539','16468085947','16468087707','16468085164','16468087728','16468087722','16468087713','16468087698')
     ORDER BY dockey`
  );
  console.log('\nAll 8 current payment_ids:');
  for (const row of r2) {
    console.log(` dockey=${row.dockey} → payment_id=${row.payment_id}`);
  }

  // Check batch entries
  const r3 = await p.$queryRawUnsafe(
    `SELECT btb.payment_id as btb_payment_id, btb.partition_amount, t.dockey
     FROM bank_transaction_batches btb
     JOIN "GE78BG0000000893486000_BOG_GEL" t ON t.raw_record_uuid::text = btb.raw_record_uuid::text
     WHERE t.dockey IN ('16468086539','16468085947','16468087707','16468085164','16468087728','16468087722','16468087713','16468087698')
     ORDER BY t.dockey`
  );
  console.log('\nBatch entries:', r3.length);
  for (const row of r3) {
    console.log(` dockey=${row.dockey} btb_payment_id=${row.btb_payment_id} amount=${row.partition_amount}`);
  }

  await p.$disconnect();
})();
