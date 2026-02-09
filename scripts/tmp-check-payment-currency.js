const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const paymentId = process.argv[2];
if (!paymentId) {
  console.error('Usage: node tmp-check-payment-currency.js <payment_id>');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT p.payment_id, p.currency_uuid, c.code, c.name
       FROM payments p
       LEFT JOIN currencies c ON p.currency_uuid = c.uuid
       WHERE p.payment_id = $1
       LIMIT 1`,
      [paymentId]
    );
    if (res.rows.length === 0) {
      console.log('Payment not found:', paymentId);
      return;
    }
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
