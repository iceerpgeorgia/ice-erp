// Investigate & fix duplicate non-bundle payments for Park Home Saburtalo
// Payment: 1.1.1 | ნუცუბიძე | 626,280.00 | USD | 20.05.2022
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const bigintReplacer = (k, v) => typeof v === 'bigint' ? Number(v) : v;
const log = (label, data) => {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, bigintReplacer, 2));
};

async function main() {
  // ─── 1. Find project ────────────────────────────────────────────────────────
  const projects = await p.$queryRawUnsafe(`
    SELECT project_uuid, name FROM projects
    WHERE name ILIKE '%Park Home Saburtalo%' ORDER BY name
  `);
  log('Projects matching "Park Home Saburtalo"', projects);
  if (!projects.length) { console.error('Not found'); return; }

  const projectUuidsLiteral = projects.map(r => `'${r.project_uuid}'`).join(', ');

  // ─── 2. Find counteragent ────────────────────────────────────────────────────
  const cas = await p.$queryRawUnsafe(`
    SELECT counteragent_uuid, name FROM counteragents
    WHERE name ILIKE '%ნუცუბიძე%' ORDER BY name
  `);
  log('Counteragents matching ნუცუბიძე', cas);

  const caUuidsLiteral = cas.map(r => `'${r.counteragent_uuid}'`).join(', ');

  // ─── 3. Find USD currency ────────────────────────────────────────────────────
  const [usdCur] = await p.$queryRawUnsafe(`SELECT uuid, code FROM currencies WHERE code = 'USD'`);
  log('USD currency', usdCur);
  const usdUuid = usdCur?.uuid;

  // ─── 4. Find all matching payments ──────────────────────────────────────────
  const payments = await p.$queryRawUnsafe(`
    SELECT
      p.id,
      p.payment_id,
      p.record_uuid,
      ca.name AS counteragent_name,
      proj.name AS project_name,
      fc.code AS fc_code,
      cur.code AS currency,
      p.order_amount,
      p.is_bundle,
      p.is_active,
      p.waybill_derived,
      p.created_at,
      (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false)::int AS ledger_count,
      (SELECT COALESCE(SUM(pl."order"), 0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false) AS ledger_order_sum,
      (SELECT COUNT(*) FROM payment_adjustments pa WHERE pa.payment_id = p.payment_id AND pa.is_deleted = false)::int AS adj_count
    FROM payments p
    LEFT JOIN counteragents ca USING (counteragent_uuid)
    LEFT JOIN projects proj USING (project_uuid)
    LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    LEFT JOIN currencies cur ON cur.uuid = p.currency_uuid
    WHERE p.project_uuid IN (${projectUuidsLiteral})
      ${cas.length > 0 ? `AND p.counteragent_uuid IN (${caUuidsLiteral})` : ''}
      ${usdUuid ? `AND p.currency_uuid = '${usdUuid}'` : ''}
    ORDER BY p.is_bundle DESC NULLS LAST, p.created_at
  `);
  log('All matching payments (sorted: bundles first)', payments);

  // ─── 5. Ledger entries ───────────────────────────────────────────────────────
  if (payments.length > 0) {
    const payIds = payments.map(r => `'${r.payment_id}'`).join(', ');
    const ledger = await p.$queryRawUnsafe(`
      SELECT pl.id, pl.payment_id, pl.effective_date, pl.accrual, pl."order", pl.comment, pl.is_deleted, pl.created_at
      FROM payments_ledger pl
      WHERE pl.payment_id IN (${payIds})
      ORDER BY pl.payment_id, pl.effective_date
    `);
    log('All ledger entries', ledger);

    const adjs = await p.$queryRawUnsafe(`
      SELECT pa.id, pa.payment_id, pa.effective_date, pa.amount, pa.face_currency_code, pa.face_amount, pa.comment, pa.is_deleted
      FROM payment_adjustments pa
      WHERE pa.payment_id IN (${payIds})
      ORDER BY pa.payment_id, pa.effective_date
    `);
    log('All adjustments', adjs);
  }

  console.log('\n=== DIAGNOSIS COMPLETE — review above before running fix ===');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
