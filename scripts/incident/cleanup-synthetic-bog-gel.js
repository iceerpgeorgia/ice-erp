require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const TABLE = 'GE78BG0000000893486000_BOG_GEL';
const PATTERN = 'API_DOC_%';

async function preview(client) {
  const counts = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE dockey LIKE '${PATTERN}')::int AS synthetic_rows,
      COUNT(*) FILTER (WHERE dockey NOT LIKE '${PATTERN}')::int AS original_rows,
      COUNT(*)::int AS total_rows
    FROM "${TABLE}";
  `);

  const dateImpact = await client.query(`
    SELECT
      transaction_date,
      COUNT(*) FILTER (WHERE dockey LIKE '${PATTERN}')::int AS synthetic_rows,
      COUNT(*) FILTER (WHERE dockey NOT LIKE '${PATTERN}')::int AS original_rows
    FROM "${TABLE}"
    GROUP BY transaction_date
    HAVING COUNT(*) FILTER (WHERE dockey LIKE '${PATTERN}') > 0
    ORDER BY transaction_date;
  `);

  return {
    table: TABLE,
    counts: counts.rows[0],
    affectedDates: dateImpact.rows,
  };
}

async function apply(client) {
  const backupTable = `incident_backup_synthetic_bog_gel_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;

  await client.query('BEGIN');
  try {
    await client.query(`CREATE TABLE "${backupTable}" AS SELECT * FROM "${TABLE}" WHERE dockey LIKE '${PATTERN}';`);

    const backupCountRes = await client.query(`SELECT COUNT(*)::int AS c FROM "${backupTable}";`);
    const backupCount = backupCountRes.rows[0].c;

    const delRes = await client.query(`DELETE FROM "${TABLE}" WHERE dockey LIKE '${PATTERN}';`);

    const remainingRes = await client.query(`SELECT COUNT(*)::int AS c FROM "${TABLE}" WHERE dockey LIKE '${PATTERN}';`);
    const remainingSynthetic = remainingRes.rows[0].c;

    await client.query('COMMIT');

    return {
      backupTable,
      backupCount,
      deletedRows: delRes.rowCount || 0,
      remainingSynthetic,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function main() {
  const mode = process.argv[2] || 'preview';
  if (!['preview', 'apply'].includes(mode)) {
    throw new Error('Usage: node scripts/incident/cleanup-synthetic-bog-gel.js [preview|apply]');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    if (mode === 'preview') {
      const result = await preview(client);
      console.log(JSON.stringify({ mode, ...result }, null, 2));
      return;
    }

    const result = await apply(client);
    console.log(JSON.stringify({ mode, table: TABLE, ...result }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
