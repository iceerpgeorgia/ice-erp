/**
 * Consolidate duplicate WB- payments.
 *
 * Multiple waybills with the same (counteragent, project, FC, currency) each
 * got their own WB-{rs_id} payment during backfill. This script merges those
 * into one canonical payment per group, re-linking all ledger entries to it.
 *
 * Canonical = the payment with the lexicographically smallest payment_id in the group.
 *
 * Runs in 2 bulk SQL statements — no per-group loops.
 *
 * Usage: node _consolidate_wb_payments.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  console.log('=== Consolidate WB- Duplicate Payments ===\n');

  // ── 1. Before state ────────────────────────────────────────────────────────
  const before = await p.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM payments WHERE payment_id LIKE 'WB-%') AS total_payments,
      (SELECT COUNT(*)::int FROM payments_ledger WHERE payment_id LIKE 'WB-%') AS total_ledger,
      (SELECT COUNT(*)::int
       FROM (
         SELECT MIN(payment_id) AS canonical_payment_id
         FROM payments
         WHERE payment_id LIKE 'WB-%' AND waybill_derived = TRUE
         GROUP BY counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
         HAVING COUNT(*) > 1
       ) sub
      ) AS duplicate_groups
  `);
  console.log(`Before: ${before[0].total_payments} WB- payments, ${before[0].total_ledger} ledger entries`);
  console.log(`Duplicate groups: ${before[0].duplicate_groups}`);
  if (Number(before[0].duplicate_groups) === 0) {
    console.log('Nothing to consolidate.');
    return;
  }

  // ── 2. Re-link all ledger entries: non-canonical → canonical (one UPDATE) ─
  console.log('\nStep 1: Re-linking ledger entries...');
  const ledgerMoved = await p.$executeRawUnsafe(`
    UPDATE payments_ledger pl
    SET payment_id = mapping.canonical_payment_id
    FROM (
      SELECT
        payment_id AS non_canonical_id,
        MIN(payment_id) OVER (
          PARTITION BY counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
        ) AS canonical_payment_id
      FROM payments
      WHERE payment_id LIKE 'WB-%' AND waybill_derived = TRUE
    ) mapping
    WHERE pl.payment_id = mapping.non_canonical_id
      AND mapping.non_canonical_id <> mapping.canonical_payment_id
  `);
  console.log(`  Ledger entries re-linked: ${ledgerMoved}`);

  // ── 3. Delete non-canonical payments in chunks ────────────────────────────
  // The CASCADE on payments_ledger and payments_adjustments can be slow
  // for large single-statement DELETEs — process in batches of 500.
  console.log('\nStep 2: Deleting non-canonical payments (chunks of 500)...');
  let paymentsDeleted = 0;
  while (true) {
    const chunk = await p.$executeRawUnsafe(`
      WITH to_delete AS (
        SELECT t.payment_id
        FROM (
          SELECT
            payment_id,
            MIN(payment_id) OVER (
              PARTITION BY counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid
            ) AS canonical_payment_id
          FROM payments
          WHERE payment_id LIKE 'WB-%' AND waybill_derived = TRUE
        ) t
        WHERE t.payment_id <> t.canonical_payment_id
        LIMIT 500
      )
      DELETE FROM payments WHERE payment_id IN (SELECT payment_id FROM to_delete)
    `);
    paymentsDeleted += chunk;
    process.stdout.write(`\r  Deleted: ${paymentsDeleted} payments`);
    if (chunk === 0) break;
  }
  console.log(`\n  Total non-canonical payments deleted: ${paymentsDeleted}`);

  // ── 4. After state ─────────────────────────────────────────────────────────
  const after = await p.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM payments WHERE payment_id LIKE 'WB-%') AS total_payments,
      (SELECT COUNT(*)::int FROM payments_ledger WHERE payment_id LIKE 'WB-%') AS total_ledger
  `);
  console.log(`\nAfter: ${after[0].total_payments} WB- payments, ${after[0].total_ledger} ledger entries`);
  console.log('\n=== Done ===');
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
