import { prisma } from '@/lib/prisma';

/**
 * Georgian waybill return type label. When a waybill has this type,
 * the payment amount should be negated.
 */
const RETURN_TYPE = 'უკან დაბრუნება';

export interface WaybillForPaymentSync {
  rs_id: string;
  sum?: any; // Prisma Decimal or number or null
  type?: string | null;
  waybill_no?: string | null;
  project_uuid?: string | null;
  counteragent_uuid?: string | null;
  activation_time?: Date | null;
  insider_uuid?: string | null;
}

/**
 * Creates or updates the waybill-derived payment + payments_ledger entry for a given waybill.
 *
 * Called whenever a waybill is bound / re-bound / unbound from a project.
 *
 * Payment ID convention: WB-{rs_id}
 * Currency:              always GEL
 * Financial code:        cost FC derived from the project's income FC (via default_code_fc);
 *                        falls back to FC 3.9.4 when no project or no cost FC is configured.
 *
 * Returns { skipped: true, reason } when a required field is missing and no payment is created.
 */
export async function syncWaybillPayment(
  waybill: WaybillForPaymentSync,
  userEmail = 'system'
): Promise<{ skipped: boolean; reason?: string }> {
  const paymentId = `WB-${waybill.rs_id}`;

  // ── 1. Guard: counteragent required ──────────────────────────────────────
  if (!waybill.counteragent_uuid) {
    console.warn(`[syncWaybillPayment] Skipping ${paymentId}: no counteragent_uuid`);
    return { skipped: true, reason: 'no counteragent_uuid on waybill' };
  }

  // ── 2. Guard: insider required (ledger filter uses insider_uuid) ──────────
  if (!waybill.insider_uuid) {
    console.warn(`[syncWaybillPayment] Skipping ${paymentId}: no insider_uuid`);
    return { skipped: true, reason: 'no insider_uuid on waybill' };
  }

  // ── 3. GEL currency UUID ──────────────────────────────────────────────────
  const gelRows = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `SELECT uuid FROM currencies WHERE code = 'GEL' AND is_active = true LIMIT 1`
  );
  if (!gelRows.length) {
    console.warn(`[syncWaybillPayment] Skipping ${paymentId}: GEL currency not found`);
    return { skipped: true, reason: 'GEL currency not found' };
  }
  const gelUuid = gelRows[0].uuid;

  // ── 4. Financial code UUID ────────────────────────────────────────────────
  //  Priority: project's income FC → default_code_fc (cost FC)  →  FC 3.9.4 fallback
  let financialCodeUuid: string | null = null;

  if (waybill.project_uuid) {
    const fcRows = await prisma.$queryRawUnsafe<Array<{ cost_fc_uuid: string | null }>>(
      `SELECT fc.default_code_fc AS cost_fc_uuid
       FROM projects proj
       LEFT JOIN financial_codes fc ON fc.uuid = proj.financial_code_uuid
       WHERE proj.project_uuid = $1::uuid
       LIMIT 1`,
      waybill.project_uuid
    );
    financialCodeUuid = fcRows[0]?.cost_fc_uuid ?? null;
  }

  // Fallback: FC 3.9.4 (covers both no-project and project-without-cost-FC cases)
  if (!financialCodeUuid) {
    const fallbackRows = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
      `SELECT uuid FROM financial_codes WHERE code = '3.9.4' AND is_active = true LIMIT 1`
    );
    if (!fallbackRows.length) {
      console.warn(`[syncWaybillPayment] Skipping ${paymentId}: FC 3.9.4 not found`);
      return { skipped: true, reason: 'FC 3.9.4 not found and no cost FC on project' };
    }
    financialCodeUuid = fallbackRows[0].uuid;
  }

  // ── 5. Amount + sign ──────────────────────────────────────────────────────
  const rawSum = waybill.sum != null ? Number(waybill.sum) : 0;
  const isReturn = (waybill.type ?? '').trim() === RETURN_TYPE;
  const amount = isReturn ? -Math.abs(rawSum) : Math.abs(rawSum);
  // Keep null for zero sums (consistent with payments_ledger validation pattern)
  const amountParam = rawSum === 0 ? null : amount;

  // ── 6. Effective date (use activation_time date, fallback to today) ────────
  const effectiveDate = waybill.activation_time
    ? waybill.activation_time.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  // ── 7. Comment + label ────────────────────────────────────────────────────
  const waybillLabel = waybill.waybill_no ?? waybill.rs_id;
  const comment = `Waybill: ${waybillLabel}`;

  // ── 8. Find-or-create the GROUP payment ───────────────────────────────────
  //  One payment per (counteragent, project, FC, currency) for waybill-derived payments.
  //  Reuse an existing WB payment for this combination rather than creating a new one.
  const existingGroupPayment = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
    `SELECT payment_id FROM payments
     WHERE waybill_derived = TRUE
       AND is_active = TRUE
       AND counteragent_uuid = $1::uuid
       AND financial_code_uuid = $2::uuid
       AND currency_uuid = $3::uuid
       AND project_uuid IS NOT DISTINCT FROM $4::uuid
     LIMIT 1`,
    waybill.counteragent_uuid,
    financialCodeUuid,
    gelUuid,
    waybill.project_uuid ?? null
  );

  let targetPaymentId: string;
  if (existingGroupPayment.length > 0) {
    targetPaymentId = existingGroupPayment[0].payment_id;
    await prisma.$executeRawUnsafe(
      `UPDATE payments SET updated_at = NOW() WHERE payment_id = $1`,
      targetPaymentId
    );
  } else {
    targetPaymentId = paymentId; // WB-{rs_id}
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
      targetPaymentId,
      waybill.project_uuid ?? null,
      waybill.counteragent_uuid,
      financialCodeUuid,
      gelUuid,
      waybill.insider_uuid,
      waybillLabel
    );
  }

  // ── 9. Upsert ledger entry (skip zero-sum waybills) ────────────────────────
  //  check_accrual_or_order requires at least one of accrual/order to be non-null and non-zero.
  if (amountParam === null) {
    return { skipped: false }; // payment record created but no ledger entry for zero-sum waybills
  }

  // Remove any existing WB ledger entry for this waybill (handles project re-binding:
  // deletes from the old group payment, inserts fresh under the new one).
  await prisma.$executeRawUnsafe(
    `DELETE FROM payments_ledger
     WHERE comment = $1
       AND (is_deleted = false OR is_deleted IS NULL)
       AND payment_id IN (
         SELECT payment_id FROM payments WHERE waybill_derived = TRUE AND is_active = TRUE
       )`,
    comment
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO payments_ledger (
       payment_id, effective_date, accrual, "order", comment,
       user_email, confirmed, insider_uuid
     )
     VALUES ($1, $2::timestamp, $3, $3, $4, $5, false, $6::uuid)`,
    targetPaymentId,
    effectiveDate,
    amountParam,
    comment,
    userEmail,
    waybill.insider_uuid
  );

  return { skipped: false };
}
