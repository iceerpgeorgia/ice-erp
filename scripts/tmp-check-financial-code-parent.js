const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const code = process.argv[2];
if (!code) {
  console.error('Usage: node tmp-check-financial-code-parent.js <code>');
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT code, parent_uuid FROM financial_codes WHERE code = $1 LIMIT 1',
      [code]
    );
    if (res.rows.length === 0) {
      console.log(`Code not found: ${code}`);
      return;
    }

    const row = res.rows[0];
    if (!row.parent_uuid) {
      console.log(`${row.code} has no parent.`);
      return;
    }

    const parentRes = await client.query(
      'SELECT code FROM financial_codes WHERE uuid = $1 LIMIT 1',
      [row.parent_uuid]
    );
    const parentCode = parentRes.rows[0]?.code || row.parent_uuid;
    console.log(`${row.code} parent: ${parentCode}`);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
