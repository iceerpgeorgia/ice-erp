const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const parentCode = '2.1.1';
const children = [
  '2.1.1.4',
  '2.1.1.5',
  '2.1.1.6',
  '2.1.1.7',
  '2.1.1.8',
  '2.1.1.9',
  '2.1.1.10',
  '2.1.1.11',
  '2.1.1.12',
  '2.1.1.13',
  '2.1.1.14',
  '2.1.1.15',
  '2.1.1.16',
  '2.1.1.17',
  '2.1.1.18',
];

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    const parentRes = await client.query(
      'SELECT uuid FROM financial_codes WHERE code = $1 LIMIT 1',
      [parentCode]
    );

    if (parentRes.rows.length === 0) {
      console.error(`Parent code not found: ${parentCode}`);
      process.exit(1);
    }

    const parentUuid = parentRes.rows[0].uuid;
    let updated = 0;

    for (const child of children) {
      const updateRes = await client.query(
        'UPDATE financial_codes SET parent_uuid = $1 WHERE code = $2',
        [parentUuid, child]
      );
      updated += updateRes.rowCount || 0;
    }

    console.log(`Updated rows: ${updated}`);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
