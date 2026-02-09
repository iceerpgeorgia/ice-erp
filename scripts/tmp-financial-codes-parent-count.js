const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT COUNT(*)::bigint AS total, SUM(CASE WHEN parent_uuid IS NOT NULL THEN 1 ELSE 0 END)::bigint AS with_parent FROM financial_codes'
    );
    const row = res.rows[0];
    console.log(`financial_codes: total=${row.total} with_parent=${row.with_parent || 0}`);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
