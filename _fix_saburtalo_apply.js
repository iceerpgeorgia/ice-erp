// FIX: Reassign bank transactions from non-bundle to bundle payments,
//       move ledger entries where needed, then delete non-bundle duplicates.
//
// FC 1.1.1.3:
//   non-bundle 67149c_44_8d4f7d (id=630) → bundle 8d9db8_5d_e91914 (id=5868)
//   - rebind raw rows 31584, 30514 → bundle payment_id
//   - move ledger id=207 → bundle payment_id
//   - delete non-bundle payment (no remaining ledger, cascade is safe)
//
// FC 1.1.1.2:
//   non-bundle b94197_21_95579c (id=1137) → bundle b9588e_96_cce31f (id=5867)
//   - rebind raw row 28715 → bundle payment_id
//   - rebind batch id=423 payment_id + payment_uuid → bundle
//   - bundle already has ledger 18535; cascade-delete non-bundle's ledger 96
//   - delete non-bundle payment

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const J = (v) => JSON.stringify(v, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2);

// Payments
const BUNDLE_1_1_1_3    = '8d9db8_5d_e91914';  // id=5868  FC 1.1.1.3
const NONBUNDLE_1_1_1_3 = '67149c_44_8d4f7d';  // id=630   FC 1.1.1.3

const BUNDLE_1_1_1_2    = 'b9588e_96_cce31f';  // id=5867  FC 1.1.1.2
const BUNDLE_1_1_1_2_RECORD_UUID = '4421c5c5-00da-4098-bfc4-fb37c5991bc6';
const NONBUNDLE_1_1_1_2 = 'b94197_21_95579c';  // id=1137  FC 1.1.1.2

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  console.log(DRY_RUN ? '\n*** DRY RUN MODE ***\n' : '\n*** LIVE MODE — changes will be committed ***\n');

  // ── Verify pre-conditions ─────────────────────────────────────────────────────
  const [b3]  = await p.$queryRawUnsafe(`SELECT payment_id, is_bundle_payment FROM payments WHERE payment_id = '${BUNDLE_1_1_1_3}'`);
  const [nb3] = await p.$queryRawUnsafe(`SELECT payment_id, is_bundle_payment FROM payments WHERE payment_id = '${NONBUNDLE_1_1_1_3}'`);
  const [b2]  = await p.$queryRawUnsafe(`SELECT payment_id, is_bundle_payment, record_uuid FROM payments WHERE payment_id = '${BUNDLE_1_1_1_2}'`);
  const [nb2] = await p.$queryRawUnsafe(`SELECT payment_id, is_bundle_payment FROM payments WHERE payment_id = '${NONBUNDLE_1_1_1_2}'`);

  console.log('Pre-condition check:');
  console.log(`  1.1.1.3 bundle:     ${J(b3)}`);
  console.log(`  1.1.1.3 non-bundle: ${J(nb3)}`);
  console.log(`  1.1.1.2 bundle:     ${J(b2)}`);
  console.log(`  1.1.1.2 non-bundle: ${J(nb2)}`);

  if (!b3?.is_bundle_payment)  throw new Error('1.1.1.3 bundle is NOT marked is_bundle_payment=true — aborting');
  if (nb3?.is_bundle_payment)  throw new Error('1.1.1.3 non-bundle IS marked is_bundle_payment — aborting');
  if (!b2?.is_bundle_payment)  throw new Error('1.1.1.2 bundle is NOT marked is_bundle_payment=true — aborting');
  if (nb2?.is_bundle_payment)  throw new Error('1.1.1.2 non-bundle IS marked is_bundle_payment — aborting');

  console.log('\nPre-conditions OK.\n');

  if (DRY_RUN) {
    console.log('Would execute the following changes:');
    console.log('  1. UPDATE GE78...BOG_GEL SET payment_id=BUNDLE_1.1.1.3 WHERE id IN (31584, 30514)');
    console.log('  2. UPDATE payments_ledger SET payment_id=BUNDLE_1.1.1.3 WHERE id=207');
    console.log('  3. DELETE FROM payments WHERE payment_id=NONBUNDLE_1.1.1.3  (cascade deletes ledger if any)');
    console.log('  4. UPDATE GE78...BOG_GEL SET payment_id=BUNDLE_1.1.1.2 WHERE id=28715');
    console.log('  5. UPDATE bank_transaction_batches SET payment_id=BUNDLE_1.1.1.2, payment_uuid=BUNDLE_RECORD_UUID WHERE id=423');
    console.log('  6. DELETE FROM payments WHERE payment_id=NONBUNDLE_1.1.1.2  (cascade deletes ledger id=96)');
    return;
  }

  // ── Step 1: Rebind raw rows for 1.1.1.3 ──────────────────────────────────────
  const r1 = await p.$queryRawUnsafe(`
    UPDATE "GE78BG0000000893486000_BOG_GEL"
    SET payment_id = '${BUNDLE_1_1_1_3}'
    WHERE id IN (31584, 30514)
    RETURNING id, payment_id
  `);
  console.log('Step 1 — rebind raw rows for 1.1.1.3:\n' + J(r1));

  // ── Step 2: Move ledger entry for 1.1.1.3 ────────────────────────────────────
  const r2 = await p.$queryRawUnsafe(`
    UPDATE payments_ledger
    SET payment_id = '${BUNDLE_1_1_1_3}', updated_at = NOW()
    WHERE id = 207
    RETURNING id, payment_id
  `);
  console.log('Step 2 — move ledger 207 to bundle 1.1.1.3:\n' + J(r2));

  // ── Step 3: Delete non-bundle 1.1.1.3 ────────────────────────────────────────
  const r3 = await p.$queryRawUnsafe(`
    DELETE FROM payments WHERE payment_id = '${NONBUNDLE_1_1_1_3}'
    RETURNING id, payment_id
  `);
  console.log('Step 3 — delete non-bundle 1.1.1.3:\n' + J(r3));

  // ── Step 4: Rebind raw row for 1.1.1.2 ───────────────────────────────────────
  const r4 = await p.$queryRawUnsafe(`
    UPDATE "GE78BG0000000893486000_BOG_GEL"
    SET payment_id = '${BUNDLE_1_1_1_2}'
    WHERE id = 28715
    RETURNING id, payment_id
  `);
  console.log('Step 4 — rebind raw row 28715 for 1.1.1.2:\n' + J(r4));

  // ── Step 5: Rebind batch partition for 1.1.1.2 ───────────────────────────────
  const r5 = await p.$queryRawUnsafe(`
    UPDATE bank_transaction_batches
    SET payment_id   = '${BUNDLE_1_1_1_2}',
        payment_uuid = '${BUNDLE_1_1_1_2_RECORD_UUID}',
        updated_at   = NOW()
    WHERE id = 423
    RETURNING id, payment_id, payment_uuid
  `);
  console.log('Step 5 — rebind batch partition 423 for 1.1.1.2:\n' + J(r5));

  // ── Step 6: Delete non-bundle 1.1.1.2 (cascade deletes ledger id=96) ─────────
  const r6 = await p.$queryRawUnsafe(`
    DELETE FROM payments WHERE payment_id = '${NONBUNDLE_1_1_1_2}'
    RETURNING id, payment_id
  `);
  console.log('Step 6 — delete non-bundle 1.1.1.2 (cascade deletes old ledger 96):\n' + J(r6));

  // ── Verify ────────────────────────────────────────────────────────────────────
  console.log('\n=== Post-fix verification ===');

  const remaining = await p.$queryRawUnsafe(`
    SELECT p.id, p.payment_id, fc.code AS fc_code, p.is_bundle_payment,
           (SELECT COUNT(*)::int FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false) AS ledger_count,
           (SELECT COALESCE(SUM(pl."order"),0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false) AS ledger_sum
    FROM payments p
    LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE p.payment_id IN ('${BUNDLE_1_1_1_3}','${NONBUNDLE_1_1_1_3}','${BUNDLE_1_1_1_2}','${NONBUNDLE_1_1_1_2}')
    ORDER BY p.id
  `);
  console.log('Remaining payments:\n' + J(remaining));

  const rawBound = await p.$queryRawUnsafe(`
    SELECT id, payment_id, nominal_amount FROM "GE78BG0000000893486000_BOG_GEL"
    WHERE id IN (28715, 30514, 31584)
    ORDER BY id
  `);
  console.log('Raw rows rebound:\n' + J(rawBound));

  const batch423 = await p.$queryRawUnsafe(`
    SELECT id, payment_id, payment_uuid FROM bank_transaction_batches WHERE id = 423
  `);
  console.log('Batch 423 rebound:\n' + J(batch423));

  console.log('\n=== FIX COMPLETE ===');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
