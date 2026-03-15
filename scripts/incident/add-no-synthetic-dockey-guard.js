require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Adds CHECK constraints to BOG statement tables so API_DOC_* keys are rejected.
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'dockey'
        AND (
          table_name LIKE '%_BOG_%'
          OR table_name LIKE 'bog_gel_raw_%'
        )
      ORDER BY table_name
    `);

    const applied = [];
    for (const row of tablesRes.rows) {
      const table = row.table_name;
      const constraintName = `${table}_no_api_doc_dockey_chk`;

      const existsRes = await client.query(
        `SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`,
        [constraintName]
      );
      if (existsRes.rowCount > 0) {
        applied.push({ table, constraint: constraintName, status: 'already-exists' });
        continue;
      }

      await client.query(`
        ALTER TABLE "${table}"
        ADD CONSTRAINT "${constraintName}"
        CHECK (dockey IS NULL OR dockey NOT LIKE 'API_DOC_%')
      `);

      applied.push({ table, constraint: constraintName, status: 'created' });
    }

    console.log(JSON.stringify({ tablesChecked: tablesRes.rowCount, applied }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
