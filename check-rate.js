const { Client } = require('pg');
const c = new Client('postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres');

(async () => {
  await c.connect();
  
  // Check latest available rates
  const r1 = await c.query(
    `SELECT date, usd_rate FROM nbg_exchange_rates WHERE date >= '2026-03-20' ORDER BY date LIMIT 5`
  );
  console.log('Rates from 2026-03-20:', r1.rows);
  
  const r2 = await c.query(
    `SELECT date, usd_rate FROM nbg_exchange_rates WHERE date <= '2026-03-23' ORDER BY date DESC LIMIT 3`
  );
  console.log('Latest rates before/on 2026-03-23:', r2.rows);
  
  // Check record 53160 details
  const r3 = await c.query(
    `SELECT id, transaction_date, correction_date, account_currency_amount, nominal_amount, exchange_rate, nominal_currency_uuid, payment_id
     FROM "GE78BG0000000893486000_BOG_GEL" WHERE id = 53160`
  );
  console.log('Record 53160:', r3.rows[0]);
  
  await c.end();
})();
