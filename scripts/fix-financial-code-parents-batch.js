const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const updates = [
  { child: '2.1.1.4', parent: '2.1.1.0' },
  { child: '3.6.1', parent: '3.6' },
  { child: '2.1.2.2', parent: '2.1.2' },
  { child: '2.2.1.3', parent: '2.2.1' },
  { child: '2.1.1.5', parent: '2.1.1.0' },
  { child: '2.1.1.6', parent: '2.1.1.0' },
  { child: '2.1.1.7', parent: '2.1.1.0' },
  { child: '2.1.1.8', parent: '2.1.1.0' },
  { child: '2.1.1.12', parent: '2.1.1.0' },
  { child: '2.1.1.13', parent: '2.1.1.0' },
  { child: '2.1.1.14', parent: '2.1.1.0' },
  { child: '2.1.1.15', parent: '2.1.1.0' },
  { child: '2.1.1.16', parent: '2.1.1.0' },
  { child: '2.1.1.17', parent: '2.1.1.0' },
  { child: '2.1.1.18', parent: '2.1.1.0' },
];

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    let updated = 0;

    for (const { child, parent } of updates) {
      const parentRes = await client.query(
        'SELECT uuid FROM financial_codes WHERE code = $1 LIMIT 1',
        [parent]
      );
      if (parentRes.rows.length === 0) {
        console.error(`Parent not found: ${parent} (for child ${child})`);
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

    const analysis = await client.query(
      `SELECT c.code AS child_code, p.code AS expected_parent
       FROM financial_codes c
       JOIN financial_codes p ON p.code = regexp_replace(c.code, '\\.[0-9]+$', '')
       WHERE c.parent_uuid IS NULL
         AND c.code ~ '^[0-9]+(\\.[0-9]+)+$'
       ORDER BY c.code`
    );

    if (analysis.rows.length) {
      console.log('Codes with missing parent_uuid but parent exists by prefix:');
      analysis.rows.forEach((row) => {
        console.log(`  ${row.child_code} -> ${row.expected_parent}`);
      });
    } else {
      console.log('No missing parent_uuid found by prefix analysis.');
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
