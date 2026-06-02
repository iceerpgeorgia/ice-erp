// Investigate duplicate non-bundle payments for Park Home Saburtalo
// Payment: 1.1.1 | ნუცუბიძე | 626,280.00 | USD | 20.05.2022
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const J = (v) => JSON.stringify(v, (k, v) => typeof v === 'bigint' ? Number(v) : v, 2);

async function main() {
  // ─── 1. Find project ────────────────────────────────────────────────────────
  const projects = await p.$queryRawUnsafe(`
    SELECT project_uuid, project_name FROM projects
    WHERE project_name ILIKE '%Park Home Saburtalo%' ORDER BY project_name
  `);
  console.log('\n=== Projects ===\n' + J(projects));
  if (!projects.length) { console.error('Project not found'); return; }
  const projectUuidsLit = projects.map(r => `'${r.project_uuid}'`).join(', ');

  // ─── 2. Find counteragent ────────────────────────────────────────────────────
  const cas = await p.$queryRawUnsafe(`
    SELECT counteragent_uuid, name FROM counteragents
    WHERE name ILIKE '%ნუცუბიძე%' ORDER BY name
  `);
  console.log('\n=== Counteragents ===\n' + J(cas));
  const caUuidsLit = cas.map(r => `'${r.counteragent_uuid}'`).join(', ');

  // ─── 3. USD currency ─────────────────────────────────────────────────────────
  const [usd] = await p.$queryRawUnsafe(`SELECT uuid, code FROM currencies WHERE code = 'USD'`);
  console.log('\n=== USD ===\n' + J(usd));

  // ─── 4. All matching payments ────────────────────────────────────────────────
  const payments = await p.$queryRawUnsafe(`
    SELECT
      p.id,
      p.payment_id,
      p.record_uuid,
      p.payment_bundle_uuid,
      pb.label AS bundle_label,
      ca.name AS counteragent_name,
      proj.project_name,
      fc.code AS fc_code,
      j.job_name AS job_desc,
      cur.code AS currency,
      p.is_bundle_payment,
      p.is_active,
      p.waybill_derived,
      p.created_at,
      (SELECT COUNT(*)::int FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false) AS ledger_count,
      (SELECT COALESCE(SUM(pl."order"), 0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false) AS ledger_order_sum,
      (SELECT COUNT(*)::int FROM payment_adjustments pa WHERE pa.payment_id = p.payment_id AND pa.is_deleted = false) AS adj_count
    FROM payments p
    LEFT JOIN counteragents ca USING (counteragent_uuid)
    LEFT JOIN projects proj USING (project_uuid)
    LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
      LEFT JOIN jobs j ON j.job_uuid = p.job_uuid
    LEFT JOIN currencies cur ON cur.uuid = p.currency_uuid
    LEFT JOIN payment_bundles pb ON pb.uuid = p.payment_bundle_uuid
    WHERE p.project_uuid IN (${projectUuidsLit})
      ${cas.length > 0 ? `AND p.counteragent_uuid IN (${caUuidsLit})` : ''}
      ${usd ? `AND p.currency_uuid = '${usd.uuid}'` : ''}
    ORDER BY p.is_bundle_payment DESC, p.payment_bundle_uuid NULLS LAST, p.created_at
  `);
  console.log('\n=== All matching payments (bundles first) ===\n' + J(payments));

  // ─── 5. Ledger entries for all these payments ────────────────────────────────
  if (payments.length > 0) {
    const payIds = payments.map(r => `'${r.payment_id}'`).join(', ');
    const ledger = await p.$queryRawUnsafe(`
      SELECT pl.id, pl.payment_id, pl.effective_date, pl.accrual, pl."order", pl.comment, pl.is_deleted, pl.created_at
      FROM payments_ledger pl
      WHERE pl.payment_id IN (${payIds})
      ORDER BY pl.payment_id, pl.effective_date
    `);
    console.log('\n=== Ledger entries ===\n' + J(ledger));

    const adjs = await p.$queryRawUnsafe(`
      SELECT pa.id, pa.payment_id, pa.effective_date, pa.amount, pa.face_currency_code, pa.face_amount, pa.comment, pa.is_deleted
      FROM payment_adjustments pa
      WHERE pa.payment_id IN (${payIds})
      ORDER BY pa.payment_id, pa.effective_date
    `);
    console.log('\n=== Adjustments ===\n' + J(adjs));
  }

  // ─── 6. Also check payment_bundles for this project × counteragent ──────────
  const bundles = await p.$queryRawUnsafe(`
    SELECT DISTINCT pb.id, pb.uuid, pb.label, pb.is_active, pb.created_at
    FROM payment_bundles pb
    JOIN payments pay ON pay.payment_bundle_uuid = pb.uuid
    WHERE pay.project_uuid IN (${projectUuidsLit})
      ${cas.length > 0 ? `AND pay.counteragent_uuid IN (${caUuidsLit})` : ''}
    ORDER BY pb.created_at
  `);
  console.log('\n=== Payment bundles for this project×counteragent ===\n' + J(bundles));

  console.log('\n=== DIAGNOSIS COMPLETE ===');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
