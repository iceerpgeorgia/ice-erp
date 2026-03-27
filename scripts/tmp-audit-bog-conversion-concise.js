require('dotenv/config');
const { Client } = require('pg');

async function main() {
  const cs = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!cs) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
  const client = new Client({ connectionString: cs });
  await client.connect();
  try {
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'GE%_BOG_%'
      ORDER BY table_name
    `);

    const perTable = [];
    let totals = {
      descMarkedMissing: 0,
      descMarkedMissingFx: 0,
      descMarkedMissingNonFx: 0,
    };

    for (const t of tables.rows) {
      const table = t.table_name;
      const c = await client.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE conversion_id IS NULL
              AND (
                description ILIKE '%ვალუტის გაცვლა%'
                OR description ILIKE '%კონვერტ%'
                OR docnomination ILIKE '%ვალუტის გაცვლა%'
                OR docnomination ILIKE '%კონვერტ%'
              )
          ) AS desc_missing,
          COUNT(*) FILTER (
            WHERE conversion_id IS NULL
              AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
              AND (
                description ILIKE '%ვალუტის გაცვლა%'
                OR description ILIKE '%კონვერტ%'
                OR docnomination ILIKE '%ვალუტის გაცვლა%'
                OR docnomination ILIKE '%კონვერტ%'
              )
          ) AS desc_missing_fx
        FROM "${table}"
      `);
      const missing = Number(c.rows[0].desc_missing || 0);
      const missingFx = Number(c.rows[0].desc_missing_fx || 0);
      perTable.push({
        table,
        descMissing: missing,
        descMissingFx: missingFx,
        descMissingNonFx: missing - missingFx,
      });
      totals.descMarkedMissing += missing;
      totals.descMarkedMissingFx += missingFx;
      totals.descMarkedMissingNonFx += missing - missingFx;
    }

    const sampleFx = await client.query(`
      WITH candidates AS (
        SELECT 'GE74BG0000000586388146_BOG_USD'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE74BG0000000586388146_BOG_USD"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_AED'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_AED"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_CNY'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_CNY"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_EUR'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_EUR"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_GBP'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_GBP"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_GEL'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_GEL"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_KZT'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_KZT"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_TRY'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_TRY"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
        UNION ALL
        SELECT 'GE78BG0000000893486000_BOG_USD'::text AS table_name, id, dockey, entriesid, transaction_date, description, docnomination, docsrcamt, docsrcccy, docdstamt, docdstccy
        FROM "GE78BG0000000893486000_BOG_USD"
        WHERE conversion_id IS NULL
          AND COALESCE(UPPER(docsrcccy),'') <> COALESCE(UPPER(docdstccy),'')
          AND (description ILIKE '%ვალუტის გაცვლა%' OR description ILIKE '%კონვერტ%' OR docnomination ILIKE '%ვალუტის გაცვლა%' OR docnomination ILIKE '%კონვერტ%')
      )
      SELECT *
      FROM candidates
      ORDER BY transaction_date DESC, id DESC
      LIMIT 30
    `);

    const outlierEntryShape = await client.query(`
      SELECT COUNT(*)::int AS not_three
      FROM (
        SELECT c.uuid, COUNT(ce.*) AS ce_count
        FROM conversion c
        LEFT JOIN conversion_entries ce ON ce.conversion_uuid = c.uuid
        GROUP BY c.uuid
        HAVING COUNT(ce.*) <> 3
      ) t
    `);

    console.log(JSON.stringify({ totals, perTable, sampleFxMissingByDescription: sampleFx.rows, conversionEntryNotThree: outlierEntryShape.rows[0] }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});