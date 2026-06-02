/**
 * Backfill waybill-derived payments and ledger entries for all existing waybills.
 *
 * Processes all rs_waybills_in_api rows that have counteragent_uuid + insider_uuid set.
 * Skips waybills that already have a WB-{rs_id} payment (updates them instead with latest data).
 *
 * Usage: node _backfill_waybill_payments.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RETURN_TYPE = 'უკან დაბრუნება';

async function run() {
  console.log('=== Backfill Waybill-Derived Payments ===\n');

  // ── Pre-load lookup data ───────────────────────────────────────────────────

  const [gelRows, fcFallbackRows, projectFcRows, existingPaymentRows, existingLedgerRows] =
    await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT uuid FROM currencies WHERE code = 'GEL' AND is_active = true LIMIT 1`
      ),
      prisma.$queryRawUnsafe(
        `SELECT uuid FROM financial_codes WHERE code = '3.9.4' AND is_active = true LIMIT 1`
      ),
      prisma.$queryRawUnsafe(`
        SELECT proj.project_uuid, fc.default_code_fc AS cost_fc_uuid
        FROM projects proj
        LEFT JOIN financial_codes fc ON fc.uuid = proj.financial_code_uuid
        WHERE proj.project_uuid IS NOT NULL
      `),
      prisma.$queryRawUnsafe(
        `SELECT payment_id FROM payments WHERE payment_id LIKE 'WB-%'`
      ),
      prisma.$queryRawUnsafe(
        `SELECT payment_id, id FROM payments_ledger
         WHERE payment_id LIKE 'WB-%' AND (is_deleted = false OR is_deleted IS NULL)`
      ),
    ]);

  if (!gelRows.length) throw new Error('GEL currency not found');
  if (!fcFallbackRows.length) throw new Error('FC 3.9.4 not found');

  const gelUuid = gelRows[0].uuid;
  const fcFallbackUuid = fcFallbackRows[0].uuid;
  console.log(`GEL currency UUID : ${gelUuid}`);
  console.log(`FC 3.9.4 UUID     : ${fcFallbackUuid}`);

  // project_uuid → cost FC UUID
  const projectCostFcMap = new Map();
  for (const row of projectFcRows) {
    if (row.cost_fc_uuid) projectCostFcMap.set(row.project_uuid, row.cost_fc_uuid);
  }
  console.log(`Projects with cost FC : ${projectCostFcMap.size}`);

  // Existing WB- payment IDs (already created)
  const existingPaymentIds = new Set(existingPaymentRows.map((r) => r.payment_id));
  console.log(`Existing WB- payments : ${existingPaymentIds.size}`);

  // Existing ledger entries for WB- payments
  const existingLedgerMap = new Map(); // payment_id → id (BigInt)
  for (const row of existingLedgerRows) {
    existingLedgerMap.set(row.payment_id, row.id);
  }
  console.log(`Existing WB- ledger entries : ${existingLedgerMap.size}`);

  // ── Load waybills to process ───────────────────────────────────────────────

  const waybills = await prisma.$queryRawUnsafe(`
    SELECT rs_id, sum, type, waybill_no, project_uuid, counteragent_uuid,
           activation_time, insider_uuid
    FROM rs_waybills_in_api
    WHERE counteragent_uuid IS NOT NULL AND insider_uuid IS NOT NULL
    ORDER BY activation_time DESC NULLS LAST
  `);

  console.log(`\nWaybills to process: ${waybills.length}\n`);

  let paymentCreated = 0, paymentUpdated = 0;
  let ledgerCreated = 0, ledgerUpdated = 0;
  let errors = 0;
  let i = 0;

  for (const w of waybills) {
    i++;
    const paymentId = `WB-${w.rs_id}`;

    // Determine financial code
    let financialCodeUuid = w.project_uuid ? (projectCostFcMap.get(w.project_uuid) ?? null) : null;
    if (!financialCodeUuid) financialCodeUuid = fcFallbackUuid;

    // Calculate amount
    const rawSum = w.sum != null ? Number(w.sum) : 0;
    const isReturn = (w.type ?? '').trim() === RETURN_TYPE;
    const amount = isReturn ? -Math.abs(rawSum) : Math.abs(rawSum);
    const amountParam = rawSum === 0 ? null : amount;

    // Effective date
    const effectiveDate = w.activation_time
      ? new Date(w.activation_time).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const waybillLabel = w.waybill_no ?? w.rs_id;
    const comment = `Waybill: ${waybillLabel}`;

    try {
      // ── Upsert payment ───────────────────────────────────────────────────
      const isNewPayment = !existingPaymentIds.has(paymentId);
      await prisma.$executeRawUnsafe(
        `INSERT INTO payments (
           payment_id, record_uuid, project_uuid, counteragent_uuid, financial_code_uuid,
           currency_uuid, insider_uuid, waybill_derived, is_active, income_tax,
           is_project_derived, is_bundle_payment, is_recurring, label, accrual_source,
           created_at, updated_at
         )
         VALUES (
           $1, gen_random_uuid(), $2::uuid, $3::uuid, $4::uuid,
           $5::uuid, $6::uuid, true, true, false,
           false, false, false, $7, 'waybill',
           NOW(), NOW()
         )
         ON CONFLICT (payment_id) DO UPDATE SET
           project_uuid        = EXCLUDED.project_uuid,
           counteragent_uuid   = EXCLUDED.counteragent_uuid,
           financial_code_uuid = EXCLUDED.financial_code_uuid,
           currency_uuid       = EXCLUDED.currency_uuid,
           insider_uuid        = COALESCE(EXCLUDED.insider_uuid, payments.insider_uuid),
           label               = EXCLUDED.label,
           updated_at          = NOW()`,
        paymentId,
        w.project_uuid ?? null,
        w.counteragent_uuid,
        financialCodeUuid,
        gelUuid,
        w.insider_uuid,
        waybillLabel
      );
      isNewPayment ? paymentCreated++ : paymentUpdated++;

      // ── Upsert ledger entry (skip zero-sum waybills) ───────────────────
      // check_accrual_or_order requires accrual/order to be non-null and non-zero
      if (amountParam !== null) {
      const existingLedgerId = existingLedgerMap.get(paymentId);
      if (existingLedgerId != null) {
        await prisma.$executeRawUnsafe(
          `UPDATE payments_ledger
           SET effective_date = $1::timestamp,
               accrual        = $2,
               "order"        = $2,
               comment        = $3,
               updated_at     = NOW()
           WHERE id = $4`,
          effectiveDate,
          amountParam,
          comment,
          existingLedgerId
        );
        ledgerUpdated++;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO payments_ledger (
             payment_id, effective_date, accrual, "order", comment,
             user_email, confirmed, insider_uuid
           )
           VALUES ($1, $2::timestamp, $3, $3, $4, 'backfill', false, $5::uuid)`,
          paymentId,
          effectiveDate,
          amountParam,
          comment,
          w.insider_uuid
        );
        ledgerCreated++;
        // Track so we don't try to re-insert if this waybill appears twice
        existingLedgerMap.set(paymentId, BigInt(-1));
      }
      } // end amountParam !== null
    } catch (err) {
      console.error(`  [ERROR] ${paymentId}: ${err.message}`);
      errors++;
    }

    // Progress every 100
    if (i % 100 === 0 || i === waybills.length) {
      process.stdout.write(
        `\r  ${i}/${waybills.length} | payments +${paymentCreated} ~${paymentUpdated} | ledger +${ledgerCreated} ~${ledgerUpdated} | errors ${errors}   `
      );
    }
  }

  console.log('\n\n=== Done ===');
  console.log(`Payments  created: ${paymentCreated}  updated: ${paymentUpdated}`);
  console.log(`Ledger    created: ${ledgerCreated}  updated: ${ledgerUpdated}`);
  console.log(`Errors    : ${errors}`);
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
