require('dotenv/config');
const { Client } = require('pg');

async function main() {
  const cs = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!cs) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
  const client = new Client({ connectionString: cs });
  await client.connect();

  try {
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'GE%_BOG_%'
      ORDER BY table_name
    `);

    const missingByDescription = [];
    for (const r of tablesRes.rows) {
      const table = r.table_name;
      const q = await client.query(
        `SELECT $1::text AS table_name, id, uuid, dockey, entriesid, transaction_date, description, conversion_id
         FROM "${table}"
         WHERE conversion_id IS NULL
           AND (
             description ILIKE '%ვალუტის გაცვლა%'
             OR description ILIKE '%კონვერტ%'
             OR docnomination ILIKE '%ვალუტის გაცვლა%'
             OR docnomination ILIKE '%კონვერტ%'
           )
         ORDER BY transaction_date DESC, id DESC
         LIMIT 50`,
        [table]
      );
      missingByDescription.push(...q.rows);
    }

    const conversionEntryShape = await client.query(`
      SELECT
        COUNT(*) AS conversions_total,
        COUNT(*) FILTER (WHERE ce_count = 3) AS conversions_with_3_entries,
        COUNT(*) FILTER (WHERE ce_count <> 3) AS conversions_not_3_entries
      FROM (
        SELECT c.uuid, COUNT(ce.*) AS ce_count
        FROM conversion c
        LEFT JOIN conversion_entries ce ON ce.conversion_uuid = c.uuid
        GROUP BY c.uuid
      ) t
    `);

    const conversionEntryOutliers = await client.query(`
      SELECT c.id, c.uuid, c.key_value, COUNT(ce.*) AS ce_count,
             STRING_AGG(COALESCE(ce.entry_type, 'NULL'), ',' ORDER BY ce.entry_type) AS entry_types
      FROM conversion c
      LEFT JOIN conversion_entries ce ON ce.conversion_uuid = c.uuid
      GROUP BY c.id, c.uuid, c.key_value
      HAVING COUNT(ce.*) <> 3
      ORDER BY c.id DESC
      LIMIT 50
    `);

    console.log(JSON.stringify({
      missingConversionByDescriptionCount: missingByDescription.length,
      missingConversionByDescriptionSample: missingByDescription,
      conversionEntryShape: conversionEntryShape.rows[0],
      conversionEntryOutliers: conversionEntryOutliers.rows,
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});