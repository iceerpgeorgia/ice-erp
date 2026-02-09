const { Pool } = require('pg');

const tables = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    for (const table of tables) {
      const res = await client.query(
        `SELECT COUNT(*)::bigint AS total, SUM(CASE WHEN parsing_lock THEN 1 ELSE 0 END)::bigint AS locked FROM "${table}"`
      );
      const row = res.rows[0];
      console.log(`${table}: total=${row.total} locked=${row.locked || 0}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
