/**
 * Efficient SQL-based backfill: creates waybill-derived payments + ledger entries
 * for all rs_waybills_in_api rows that have counteragent_uuid + insider_uuid.
 *
 * Uses two bulk SQL operations instead of per-row queries.
 * Usage: node _backfill_waybill_payments.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== Backfill Waybill-Derived Payments (SQL batch mode) ===\n');

  // ── Step 1: Lookup UUIDs ───────────────────────────────────────────────────
  const [gelRows, fcFallbackRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT uuid FROM currencies WHERE code = 'GEL' AND is_active = true LIMIT 1`),
    prisma.$queryRawUnsafe(`SELECT uuid FROM financial_codes WHERE code = '3.9.4' AND is_active = true LIMIT 1`),
  ]);

  if (!gelRows.length) throw new Error('GEL currency not found');
  if (!fcFallbackRows.length) throw new Error('FC 3.9.4 not found');

  const gelUuid = gelRows[0].uuid;
  const fcFallbackUuid = fcFallbackRows[0].uuid;
  console.log(`GEL UUID  : ${gelUuid}`);
  console.log(`FC 3.9.4  : ${fcFallbackUuid}`);

  // ── Step 2: Count waybills to process ──────────────────────────────────────
  const countRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS cnt
    FROM rs_waybills_in_api
    WHERE counteragent_uuid IS NOT NULL AND insider_uuid IS NOT NULL
  `);
  console.log(`Waybills eligible : ${countRows[0].cnt}\n`);

  // ── Step 3: Bulk upsert payments ───────────────────────────────────────────
  console.log('Upserting payments...');
  const paymentResult = await prisma.$queryRawUnsafe(`
    WITH waybill_data AS (
      SELECT
        w.rs_id,
        'WB-' || w.rs_id::text                                   AS payment_id,
        w.project_uuid,
        w.counteragent_uuid,
        COALESCE(fc.default_code_fc, $1::uuid)                   AS financial_code_uuid,
        $2::uuid                                                  AS currency_uuid,
        w.insider_uuid,
        COALESCE(w.waybill_no, w.rs_id::text)                    AS label
      FROM rs_waybills_in_api w
      LEFT JOIN projects proj     ON proj.project_uuid     = w.project_uuid
      LEFT JOIN financial_codes fc ON fc.uuid              = proj.financial_code_uuid
      WHERE w.counteragent_uuid IS NOT NULL
        AND w.insider_uuid IS NOT NULL
    ),
    upsert AS (
      INSERT INTO payments (
        payment_id, record_uuid, project_uuid, counteragent_uuid, financial_code_uuid,
        currency_uuid, insider_uuid, waybill_derived, is_active, income_tax,
        is_project_derived, is_bundle_payment, is_recurring, label, accrual_source,
        created_at, updated_at
      )
      SELECT
        wd.payment_id,
        gen_random_uuid(),
        wd.project_uuid,
        wd.counteragent_uuid,
        wd.financial_code_uuid,
        wd.currency_uuid,
        wd.insider_uuid,
        true, true, false, false, false, false,
        wd.label,
        'waybill',
        NOW(), NOW()
      FROM waybill_data wd
      ON CONFLICT (payment_id) DO UPDATE SET
        project_uuid        = EXCLUDED.project_uuid,
        counteragent_uuid   = EXCLUDED.counteragent_uuid,
        financial_code_uuid = EXCLUDED.financial_code_uuid,
        currency_uuid       = EXCLUDED.currency_uuid,
        insider_uuid        = COALESCE(EXCLUDED.insider_uuid, payments.insider_uuid),
        label               = EXCLUDED.label,
        updated_at          = NOW()
      RETURNING payment_id, (xmax = 0) AS was_inserted
    )
    SELECT
      COUNT(*) FILTER (WHERE was_inserted)::int  AS created,
      COUNT(*) FILTER (WHERE NOT was_inserted)::int AS updated
    FROM upsert
  `, fcFallbackUuid, gelUuid);

  console.log(`  Payments created: ${paymentResult[0].created}  updated: ${paymentResult[0].updated}`);

  // ── Step 4: Bulk upsert ledger entries ─────────────────────────────────────
  // check_accrual_or_order requires non-null, non-zero accrual or order → skip zero-sum waybills.
  // We only INSERT new entries (ON CONFLICT DO NOTHING) since existing entries may have user edits.
  console.log('\nInserting new ledger entries...');
  const ledgerResult = await prisma.$queryRawUnsafe(`
    WITH waybill_amounts AS (
      SELECT
        'WB-' || w.rs_id::text                                                    AS payment_id,
        CASE WHEN trim(w.type) = 'უკან დაბრუნება'
             THEN -ABS(COALESCE(w.sum::numeric, 0))
             ELSE  ABS(COALESCE(w.sum::numeric, 0))
        END                                                                        AS amount,
        DATE_TRUNC('day', COALESCE(w.activation_time, NOW()))                     AS effective_date,
        COALESCE(w.waybill_no, w.rs_id::text)                                     AS waybill_label,
        w.insider_uuid
      FROM rs_waybills_in_api w
      WHERE w.counteragent_uuid IS NOT NULL
        AND w.insider_uuid IS NOT NULL
        AND w.sum IS NOT NULL
        AND w.sum <> 0
    ),
    insert_ledger AS (
      INSERT INTO payments_ledger (
        payment_id, effective_date, accrual, "order", comment,
        user_email, confirmed, insider_uuid
      )
      SELECT
        wa.payment_id,
        wa.effective_date,
        wa.amount,
        wa.amount,
        'Waybill: ' || wa.waybill_label,
        'backfill',
        false,
        wa.insider_uuid
      FROM waybill_amounts wa
      WHERE NOT EXISTS (
        SELECT 1 FROM payments_ledger pl
        WHERE pl.payment_id = wa.payment_id
          AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
      )
      RETURNING payment_id
    )
    SELECT COUNT(*)::int AS inserted FROM insert_ledger
  `);

  console.log(`  Ledger entries inserted: ${ledgerResult[0].inserted}`);

  // ── Step 5: Summary ────────────────────────────────────────────────────────
  const finalCount = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM payments WHERE payment_id LIKE 'WB-%') AS total_payments,
      (SELECT COUNT(*)::int FROM payments_ledger WHERE payment_id LIKE 'WB-%') AS total_ledger
  `);
  console.log(`\n=== Done ===`);
  console.log(`Total WB- payments in DB     : ${finalCount[0].total_payments}`);
  console.log(`Total WB- ledger entries in DB: ${finalCount[0].total_ledger}`);
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
