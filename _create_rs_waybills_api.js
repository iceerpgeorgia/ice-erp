/**
 * Creates the rs_waybills_api table — pure API snapshot for RS.ge waybills.
 * Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS).
 */
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS rs_waybills_api (
      id                            BIGSERIAL PRIMARY KEY,
      rs_id                         TEXT        NOT NULL UNIQUE,
      waybill_no                    TEXT,
      state                         TEXT,
      condition                     TEXT,
      category                      TEXT,
      type                          TEXT,
      counteragent                  TEXT,
      counteragent_inn              TEXT,
      counteragent_name             TEXT,
      counteragent_uuid             UUID,
      insider_uuid                  UUID,
      vat                           BOOLEAN     NOT NULL DEFAULT FALSE,
      sum                           NUMERIC(20,2),
      driver                        TEXT,
      driver_id                     TEXT,
      driver_uuid                   UUID,
      vehicle                       TEXT,
      transportation_sum            NUMERIC(20,2),
      departure_address             TEXT,
      shipping_address              TEXT,
      activation_time               TIMESTAMPTZ,
      transportation_beginning_time TIMESTAMPTZ,
      submission_time               TIMESTAMPTZ,
      cancellation_time             TIMESTAMPTZ,
      note                          TEXT,
      vat_doc_id                    TEXT,
      stat                          TEXT,
      transportation_cost           NUMERIC(20,2),
      invoice_id                    TEXT,
      is_confirmed                  BOOLEAN     NOT NULL DEFAULT FALSE,
      is_corrected                  BOOLEAN     NOT NULL DEFAULT FALSE,
      is_med                        BOOLEAN     NOT NULL DEFAULT FALSE,
      create_date                   TIMESTAMPTZ,
      seller_st                     TEXT,
      date                          TEXT,
      period                        TEXT,
      synced_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS rs_waybills_api_waybill_no_idx       ON rs_waybills_api (waybill_no);
    CREATE INDEX IF NOT EXISTS rs_waybills_api_counteragent_inn_idx  ON rs_waybills_api (counteragent_inn);
    CREATE INDEX IF NOT EXISTS rs_waybills_api_activation_time_idx   ON rs_waybills_api (activation_time);
    CREATE INDEX IF NOT EXISTS rs_waybills_api_counteragent_uuid_idx ON rs_waybills_api (counteragent_uuid);
    CREATE INDEX IF NOT EXISTS rs_waybills_api_insider_uuid_idx      ON rs_waybills_api (insider_uuid);
  `);

  console.log('rs_waybills_api table and indexes created OK');
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
