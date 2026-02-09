const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const uuids = process.argv.slice(2).map((v) => v.trim()).filter(Boolean);
if (uuids.length === 0) {
  console.error('Usage: node tmp-check-currency-by-uuid.js <uuid> [uuid...]');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT uuid, code, name FROM currencies WHERE uuid = ANY($1::uuid[])',
      [uuids]
    );
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
