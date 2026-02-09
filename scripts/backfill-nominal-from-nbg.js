const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const tables = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const rateCase = (alias) => `CASE ${alias}
  WHEN 'USD' THEN nbg.usd_rate
  WHEN 'EUR' THEN nbg.eur_rate
  WHEN 'GBP' THEN nbg.gbp_rate
  WHEN 'TRY' THEN nbg.try_rate
  WHEN 'RUB' THEN nbg.rub_rate
  WHEN 'CNY' THEN nbg.cny_rate
  WHEN 'AED' THEN nbg.aed_rate
  WHEN 'KZT' THEN nbg.kzt_rate
  ELSE NULL
END`;

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    for (const table of tables) {
      const sql = `
        WITH src AS (
          SELECT
            t.id,
            t.transaction_date::date AS rate_date,
            t.account_currency_amount::numeric AS account_amount,
            t.account_currency_uuid,
            t.nominal_currency_uuid,
            ca.code AS account_code,
            cn.code AS nominal_code
          FROM "${table}" t
          JOIN currencies ca ON ca.uuid = t.account_currency_uuid
          JOIN currencies cn ON cn.uuid = t.nominal_currency_uuid
          WHERE t.transaction_date IS NOT NULL
            AND t.nominal_currency_uuid IS NOT NULL
            AND t.account_currency_uuid IS NOT NULL
            AND t.nominal_currency_uuid <> t.account_currency_uuid
            AND (
              t.exchange_rate IS NULL
              OR t.nominal_amount IS NULL
              OR t.nominal_amount = t.account_currency_amount
            )
        ), rates AS (
          SELECT
            s.id AS row_id,
            s.rate_date,
            s.account_amount,
            s.account_code,
            s.nominal_code,
            nbg.*,
            ${rateCase('s.account_code')} AS account_rate,
            ${rateCase('s.nominal_code')} AS nominal_rate
          FROM src s
          JOIN nbg_exchange_rates nbg ON nbg.date = s.rate_date
        ), calc AS (
          SELECT
            row_id,
            account_code,
            nominal_code,
            account_amount,
            CASE
              WHEN account_code = nominal_code THEN 1
              WHEN account_code = 'GEL' THEN nominal_rate
              WHEN nominal_code = 'GEL' THEN account_rate
              ELSE account_rate / NULLIF(nominal_rate, 0)
            END AS exchange_rate,
            CASE
              WHEN account_code = nominal_code THEN account_amount
              WHEN account_code = 'GEL' THEN account_amount / NULLIF(nominal_rate, 0)
              WHEN nominal_code = 'GEL' THEN account_amount * account_rate
              ELSE account_amount / NULLIF(account_rate / NULLIF(nominal_rate, 0), 0)
            END AS nominal_amount
          FROM rates
          WHERE (
            (account_code = 'GEL' AND nominal_rate IS NOT NULL)
            OR (nominal_code = 'GEL' AND account_rate IS NOT NULL)
            OR (account_rate IS NOT NULL AND nominal_rate IS NOT NULL)
          )
        )
        UPDATE "${table}" t
        SET
          exchange_rate = ROUND(calc.exchange_rate::numeric, 10),
          nominal_amount = ROUND(calc.nominal_amount::numeric, 2)
        FROM calc
        WHERE t.id = calc.row_id
        RETURNING t.id;
      `;

      const res = await client.query(sql);
      console.log(`${table}: updated ${res.rowCount} rows`);
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
