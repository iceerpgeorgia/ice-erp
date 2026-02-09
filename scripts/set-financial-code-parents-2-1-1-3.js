const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const PARENT_CODE = '2.1.1.3';

const pool = new Pool({ connectionString: url });

(async () => {
  const client = await pool.connect();
  try {
    const parentRes = await client.query(
      'SELECT uuid FROM financial_codes WHERE code = $1 LIMIT 1',
      [PARENT_CODE]
    );

    if (parentRes.rows.length === 0) {
      console.error(`Parent code not found: ${PARENT_CODE}`);
      process.exit(1);
    }

    const parentUuid = parentRes.rows[0].uuid;

    const updateRes = await client.query(
      `UPDATE financial_codes
       SET parent_uuid = $1
       WHERE code LIKE $2
         AND code <> $3`,
      [parentUuid, `${PARENT_CODE}.%`, PARENT_CODE]
    );

    console.log(`Updated rows: ${updateRes.rowCount}`);
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
