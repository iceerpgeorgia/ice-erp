/**
 * Backfills rs_waybills_in_api from rs_waybills_in.
 * Only rows with a non-null rs_id are copied (API-sourced records).
 * User-editable fields (project_uuid, financial_code_uuid, corresponding_account)
 * are seeded from rs_waybills_in. All other fields are API fields.
 * Runs INSERT ... ON CONFLICT DO NOTHING so it is safe to re-run.
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Count source rows
  const { rows: [{ count }] } = await client.query(
    "SELECT COUNT(*) FROM rs_waybills_in WHERE rs_id IS NOT NULL"
  );
  console.log(`Source rows with rs_id: ${count}`);

  // Backfill in batches
  const BATCH = 500;
  let offset = 0;
  let inserted = 0;

  while (true) {
    const res = await client.query(
      `INSERT INTO rs_waybills_in_api (
        rs_id, waybill_no, state, condition, category, type,
        counteragent, counteragent_inn, counteragent_name,
        counteragent_uuid, insider_uuid, vat, sum,
        driver, driver_id, driver_uuid, vehicle,
        transportation_sum, departure_address, shipping_address,
        activation_time, transportation_beginning_time,
        submission_time, cancellation_time,
        note, vat_doc_id, stat, transportation_cost,
        invoice_id, is_confirmed, is_corrected, is_med,
        create_date, seller_st, date, period,
        synced_at,
        project_uuid, financial_code_uuid, corresponding_account
      )
      SELECT
        rs_id, waybill_no, state, condition, category, type,
        counteragent, counteragent_inn, counteragent_name,
        counteragent_uuid, insider_uuid, vat, sum,
        driver, driver_id, driver_uuid, vehicle,
        transportation_sum, departure_address, shipping_address,
        activation_time, transportation_beginning_time,
        submission_time, cancellation_time,
        note, vat_doc_id, stat, transportation_cost,
        invoice_id, is_confirmed, is_corrected, is_med,
        create_date, seller_st, date, period,
        COALESCE(updated_at, created_at, NOW()),
        project_uuid, financial_code_uuid, corresponding_account
      FROM rs_waybills_in
      WHERE rs_id IS NOT NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
      ON CONFLICT (rs_id) DO NOTHING`,
      [BATCH, offset]
    );

    const n = res.rowCount ?? 0;
    inserted += n;
    offset += BATCH;
    process.stdout.write(`\r  inserted so far: ${inserted} / ${count}  `);

    if (offset >= parseInt(count)) break;
  }

  console.log(`\nDone. Inserted ${inserted} rows into rs_waybills_in_api.`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
