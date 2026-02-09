require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString:
      process.env.DIRECT_DATABASE_URL ||
      process.env.REMOTE_DATABASE_URL ||
      process.env.DATABASE_URL,
  });
  await client.connect();

  const updateSql = `
    WITH parsed AS (
      SELECT r.uuid,
        COALESCE(
          CASE
            WHEN r.docvaluedate IS NULL THEN NULL
            WHEN LEFT(r.docvaluedate::text, 10) ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_date(LEFT(r.docvaluedate::text, 10), 'DD.MM.YYYY')
            WHEN LEFT(r.docvaluedate::text, 10) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(LEFT(r.docvaluedate::text, 10), 'YYYY-MM-DD')
            WHEN LEFT(r.docvaluedate::text, 8) ~ '^\\d{8}$' THEN to_date(LEFT(r.docvaluedate::text, 8), 'YYYYMMDD')
            ELSE NULL
          END,
          CASE
            WHEN r.docrecdate IS NULL THEN NULL
            WHEN LEFT(r.docrecdate::text, 10) ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_date(LEFT(r.docrecdate::text, 10), 'DD.MM.YYYY')
            WHEN LEFT(r.docrecdate::text, 10) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(LEFT(r.docrecdate::text, 10), 'YYYY-MM-DD')
            WHEN LEFT(r.docrecdate::text, 8) ~ '^\\d{8}$' THEN to_date(LEFT(r.docrecdate::text, 8), 'YYYYMMDD')
            ELSE NULL
          END,
          CASE
            WHEN r.docactualdate IS NULL THEN NULL
            WHEN LEFT(r.docactualdate::text, 10) ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_date(LEFT(r.docactualdate::text, 10), 'DD.MM.YYYY')
            WHEN LEFT(r.docactualdate::text, 10) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(LEFT(r.docactualdate::text, 10), 'YYYY-MM-DD')
            WHEN LEFT(r.docactualdate::text, 8) ~ '^\\d{8}$' THEN to_date(LEFT(r.docactualdate::text, 8), 'YYYYMMDD')
            ELSE NULL
          END,
          CASE
            WHEN r.entrypdate IS NULL THEN NULL
            WHEN LEFT(r.entrypdate::text, 10) ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_date(LEFT(r.entrypdate::text, 10), 'DD.MM.YYYY')
            WHEN LEFT(r.entrypdate::text, 10) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(LEFT(r.entrypdate::text, 10), 'YYYY-MM-DD')
            WHEN LEFT(r.entrypdate::text, 8) ~ '^\\d{8}$' THEN to_date(LEFT(r.entrypdate::text, 8), 'YYYYMMDD')
            ELSE NULL
          END
        ) AS parsed_date
      FROM bog_gel_raw_893486000 r
    )
    UPDATE "GE78BG0000000893486000_BOG_GEL" d
    SET transaction_date = p.parsed_date
    FROM parsed p
    WHERE d.uuid = p.uuid
      AND p.parsed_date IS NOT NULL
      AND d.transaction_date::date = CURRENT_DATE
    RETURNING d.id
  `;

  const res = await client.query(updateSql);
  console.log(`Updated ${res.rowCount} rows.`);
  await client.end();
})();
