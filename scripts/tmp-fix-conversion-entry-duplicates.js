require('dotenv/config');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');

    const deleteSql = `
      WITH ranked AS (
        SELECT
          ctid,
          conversion_uuid,
          entry_type,
          ROW_NUMBER() OVER (
            PARTITION BY conversion_uuid, UPPER(entry_type)
            ORDER BY
              (entry_type = UPPER(entry_type)) DESC,
              (raw_record_uuid IS NOT NULL) DESC,
              ctid
          ) AS rn
        FROM conversion_entries
      )
      DELETE FROM conversion_entries ce
      USING ranked r
      WHERE ce.ctid = r.ctid
        AND r.rn > 1
    `;

    const normalizeSql = `
      UPDATE conversion_entries
      SET entry_type = UPPER(entry_type)
      WHERE entry_type <> UPPER(entry_type)
    `;

    const checkSql = `
      SELECT COUNT(*)::int AS not_three
      FROM (
        SELECT conversion_uuid
        FROM conversion_entries
        GROUP BY conversion_uuid
        HAVING COUNT(*) <> 3
      ) x
    `;

    const deleted = await client.query(deleteSql);
    const normalized = await client.query(normalizeSql);
    const check = await client.query(checkSql);

    await client.query('COMMIT');

    console.log(
      JSON.stringify(
        {
          deletedDuplicates: deleted.rowCount,
          normalizedTypes: normalized.rowCount,
          remainingNotThree: Number(check.rows[0].not_three),
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
