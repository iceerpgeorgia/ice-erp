require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const TARGET_TABLE = 'GE78BG0000000893486000_BOG_GEL';

function usage() {
  throw new Error(
    'Usage: node scripts/incident/restore-synthetic-bog-gel.js <backup_table> [preview|apply]'
  );
}

async function preview(client, backupTable) {
  const backupCountRes = await client.query(
    `SELECT COUNT(*)::int AS c FROM "${backupTable}";`
  );
  const backupCount = backupCountRes.rows[0].c;

  const overlapRes = await client.query(`
    SELECT COUNT(*)::int AS c
    FROM "${backupTable}" b
    JOIN "${TARGET_TABLE}" t ON t.uuid = b.uuid
  `);

  const currentSyntheticRes = await client.query(`
    SELECT COUNT(*)::int AS c
    FROM "${TARGET_TABLE}"
    WHERE dockey LIKE 'API_DOC_%'
  `);

  return {
    targetTable: TARGET_TABLE,
    backupTable,
    backupRows: backupCount,
    existingUuidOverlap: overlapRes.rows[0].c,
    currentSyntheticRowsInTarget: currentSyntheticRes.rows[0].c,
  };
}

async function apply(client, backupTable) {
  await client.query('BEGIN');
  try {
    const insertRes = await client.query(`
      INSERT INTO "${TARGET_TABLE}"
      SELECT b.*
      FROM "${backupTable}" b
      WHERE NOT EXISTS (
        SELECT 1 FROM "${TARGET_TABLE}" t WHERE t.uuid = b.uuid
      )
    `);

    const finalSyntheticRes = await client.query(`
      SELECT COUNT(*)::int AS c
      FROM "${TARGET_TABLE}"
      WHERE dockey LIKE 'API_DOC_%'
    `);

    await client.query('COMMIT');

    return {
      targetTable: TARGET_TABLE,
      backupTable,
      insertedRows: insertRes.rowCount || 0,
      finalSyntheticRowsInTarget: finalSyntheticRes.rows[0].c,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function main() {
  const backupTable = process.argv[2];
  const mode = process.argv[3] || 'preview';

  if (!backupTable) usage();
  if (!['preview', 'apply'].includes(mode)) usage();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    if (mode === 'preview') {
      const result = await preview(client, backupTable);
      console.log(JSON.stringify({ mode, ...result }, null, 2));
      return;
    }

    const result = await apply(client, backupTable);
    console.log(JSON.stringify({ mode, ...result }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
