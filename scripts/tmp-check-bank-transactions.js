const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const ids = process.argv.slice(2).map((v) => v.trim()).filter(Boolean);
if (ids.length === 0) {
  console.error('Usage: node tmp-check-bank-transactions.js <id> [id...]');
  process.exit(1);
}

const tables = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    for (const table of tables) {
      const res = await client.query(
        `SELECT id, uuid, transaction_date, account_currency_amount, account_currency_uuid, nominal_amount, nominal_currency_uuid, exchange_rate, nominal_exchange_rate, description, payment_id, parsing_lock
         FROM "${table}"
         WHERE id = ANY($1::bigint[])`,
        [ids]
      );
      if (res.rows.length) {
        console.log(`\nTable: ${table}`);
        for (const row of res.rows) {
          console.log(row);
        }
      }
    }

    const rateRes = await client.query(
      `SELECT date, usd_rate, eur_rate, gbp_rate, try_rate, rub_rate, cny_rate, aed_rate, kzt_rate
       FROM nbg_exchange_rates
       WHERE date IN (
         SELECT DISTINCT transaction_date::date
         FROM (
           SELECT transaction_date FROM "GE78BG0000000893486000_BOG_GEL" WHERE id = ANY($1::bigint[])
           UNION ALL
           SELECT transaction_date FROM "GE65TB7856036050100002_TBC_GEL" WHERE id = ANY($1::bigint[])
         ) d
         WHERE transaction_date IS NOT NULL
       )
       ORDER BY date`,
      [ids]
    );

    if (rateRes.rows.length) {
      console.log('\nRates for transaction dates:');
      console.table(rateRes.rows);
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
