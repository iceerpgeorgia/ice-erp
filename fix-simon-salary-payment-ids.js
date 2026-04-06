/**
 * Fix: Set all 8 Simon Sheshelidze salary transactions to PRL032023.
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const TABLE = 'GE78BG0000000893486000_BOG_GEL';
const PAYMENT_ID = 'NP_c726e1_NJ_4532f8_PRL032023';

const DOCKEYS = [
  '16468086539',
  '16468085947',
  '16468087707',
  '16468085164',
  '16468087728',
  '16468087722',
  '16468087713',
  '16468087698',
];

(async () => {
  const result = await p.$queryRawUnsafe(
    `UPDATE "${TABLE}"
     SET payment_id = $1, parsing_lock = true, updated_at = NOW()
     WHERE dockey = ANY($2::text[])
     RETURNING dockey, payment_id`,
    PAYMENT_ID,
    DOCKEYS
  );
  console.log(`Updated ${result.length} records:`);
  for (const row of result) {
    console.log(` dockey=${row.dockey} → ${row.payment_id}`);
  }
  await p.$disconnect();
})();
