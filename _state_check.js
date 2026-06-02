// Quick state check after crash
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const J = (v) => JSON.stringify(v, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2);

async function main() {
  const pay = await p.$queryRawUnsafe(`
    SELECT p.id, p.payment_id, p.is_bundle_payment,
      (SELECT COUNT(*)::int FROM payments_ledger pl WHERE pl.payment_id=p.payment_id AND pl.is_deleted=false) AS ledger_count
    FROM payments p
    WHERE p.payment_id IN ('8d9db8_5d_e91914','67149c_44_8d4f7d','b9588e_96_cce31f','b94197_21_95579c')
    ORDER BY p.id
  `);
  console.log('Payments state:\n' + J(pay));

  const raw = await p.$queryRawUnsafe(`
    SELECT id, payment_id FROM "GE78BG0000000893486000_BOG_GEL"
    WHERE id IN (28715, 30514, 31584) ORDER BY id
  `);
  console.log('Raw rows:\n' + J(raw));

  const bt = await p.$queryRawUnsafe(`
    SELECT id, payment_id, payment_uuid FROM bank_transaction_batches WHERE id = 423
  `);
  console.log('Batch 423:\n' + J(bt));
}

main().finally(() => p.$disconnect()).catch(e => { console.error(e); process.exit(1); });
