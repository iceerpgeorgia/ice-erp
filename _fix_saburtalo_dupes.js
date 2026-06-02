// Investigate & fix duplicate non-bundle payments for Park Home Saburtalo
// Payment: 1.1.1 | ნუცუბიძე | 626,280.00 | USD | 20.05.2022
// Steps:
//   1. DIAGNOSE: find the project, find all matching payments, show ledger entries
//   2. FIX: reassign ledger entries to bundle payment, delete duplicate payments

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  // ─── 1. Find project ────────────────────────────────────────────────────────
  const projRes = await client.query(`
    SELECT project_uuid, name
    FROM projects
    WHERE name ILIKE '%Park Home Saburtalo%'
    ORDER BY name
  `);
  console.log('=== Projects matching "Park Home Saburtalo" ===');
  console.table(projRes.rows);

  if (projRes.rows.length === 0) {
    console.error('Project not found, aborting.');
    await client.end();
    return;
  }

  const projectUuids = projRes.rows.map(r => r.project_uuid);
  const projectUuidsLiteral = projectUuids.map(u => `'${u}'`).join(', ');

  // ─── 2. Find counteragent ნუცუბიძე ──────────────────────────────────────────
  const caRes = await client.query(`
    SELECT counteragent_uuid, name
    FROM counteragents
    WHERE name ILIKE '%ნუცუბიძე%'
    ORDER BY name
  `);
  console.log('\n=== Counteragents matching ნუცუბიძე ===');
  console.table(caRes.rows);

  // ─── 3. Find USD currency uuid ──────────────────────────────────────────────
  const currRes = await client.query(`SELECT uuid, code FROM currencies WHERE code = 'USD'`);
  console.log('\n=== USD currency ===');
  console.table(currRes.rows);

  const caUuids = caRes.rows.map(r => r.counteragent_uuid);
  const caUuidsLiteral = caUuids.map(u => `'${u}'`).join(', ');
  const usdUuid = currRes.rows[0]?.uuid;

  // ─── 4. Find all payments for this project × counteragent × USD ─────────────
  const payRes = await client.query(`
    SELECT
      p.id,
      p.payment_id,
      p.record_uuid,
      p.counteragent_uuid,
      ca.name AS counteragent_name,
      p.project_uuid,
      proj.name AS project_name,
      p.financial_code_uuid,
      fc.code AS fc_code,
      p.currency_uuid,
      cur.code AS currency,
      p.order_amount,
      p.is_bundle,
      p.is_active,
      p.waybill_derived,
      p.created_at,
      (
        SELECT COUNT(*) FROM payments_ledger pl
        WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false
      ) AS ledger_count,
      (
        SELECT COALESCE(SUM(pl.order), 0) FROM payments_ledger pl
        WHERE pl.payment_id = p.payment_id AND pl.is_deleted = false
      ) AS ledger_order_sum
    FROM payments p
    LEFT JOIN counteragents ca USING (counteragent_uuid)
    LEFT JOIN projects proj USING (project_uuid)
    LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    LEFT JOIN currencies cur ON cur.uuid = p.currency_uuid
    WHERE p.project_uuid IN (${projectUuidsLiteral})
      ${caUuids.length > 0 ? `AND p.counteragent_uuid IN (${caUuidsLiteral})` : ''}
      ${usdUuid ? `AND p.currency_uuid = '${usdUuid}'` : ''}
    ORDER BY p.is_bundle DESC NULLS LAST, p.created_at
  `);
  console.log('\n=== All matching payments ===');
  console.table(payRes.rows.map(r => ({
    id: r.id,
    payment_id: r.payment_id,
    fc: r.fc_code,
    currency: r.currency,
    order_amount: r.order_amount,
    is_bundle: r.is_bundle,
    is_active: r.is_active,
    waybill_derived: r.waybill_derived,
    ledger_count: r.ledger_count,
    ledger_order_sum: r.ledger_order_sum,
    created_at: r.created_at,
  })));

  // ─── 5. Show all ledger entries for these payments ──────────────────────────
  if (payRes.rows.length > 0) {
    const paymentIds = payRes.rows.map(r => `'${r.payment_id}'`).join(', ');
    const ledgerRes = await client.query(`
      SELECT
        pl.id,
        pl.payment_id,
        pl.effective_date,
        pl.accrual,
        pl.order,
        pl.comment,
        pl.is_deleted,
        pl.created_at
      FROM payments_ledger pl
      WHERE pl.payment_id IN (${paymentIds})
      ORDER BY pl.payment_id, pl.effective_date
    `);
    console.log('\n=== All ledger entries for these payments ===');
    console.table(ledgerRes.rows);
  }

  // ─── 6. Show payment_adjustments for these payments ─────────────────────────
  if (payRes.rows.length > 0) {
    const paymentIds = payRes.rows.map(r => `'${r.payment_id}'`).join(', ');
    const adjRes = await client.query(`
      SELECT
        pa.id,
        pa.payment_id,
        pa.effective_date,
        pa.amount,
        pa.face_currency_code,
        pa.face_amount,
        pa.comment,
        pa.is_deleted
      FROM payment_adjustments pa
      WHERE pa.payment_id IN (${paymentIds})
      ORDER BY pa.payment_id, pa.effective_date
    `);
    console.log('\n=== All adjustments for these payments ===');
    console.table(adjRes.rows);
  }

  await client.end();
  console.log('\n=== DIAGNOSIS COMPLETE — review above before running fix ===');
}

main().catch(e => { console.error(e); process.exit(1); });
