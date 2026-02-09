const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const mappings = [
  { child: '3.1.2', parent: '3.1' },
  { child: '3.1.4', parent: '3.1' },
  { child: '3.1.6', parent: '3.1' },
  { child: '2.2.1.9', parent: '2.2.1' },
  { child: '2.2.1.10', parent: '2.2.1' },
  { child: '2.2.1.11', parent: '2.2.1' },
];

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    let updated = 0;

    for (const { child, parent } of mappings) {
      const parentRes = await client.query(
        'SELECT uuid FROM financial_codes WHERE code = $1 LIMIT 1',
        [parent]
      );
      if (parentRes.rows.length === 0) {
        console.error(`Parent not found: ${parent} (child ${child})`);
        continue;
      }
      const parentUuid = parentRes.rows[0].uuid;
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
