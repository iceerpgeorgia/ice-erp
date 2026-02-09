require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const tables = ['bog_gel_raw_893486000', '"GE78BG0000000893486000_BOG_GEL"'];
const columns = ['docvaluedate', 'docrecdate', 'docactualdate', 'entrypdate'];

const dateExpr = (col) => `
  CASE
    WHEN ${col} IS NULL THEN NULL
    WHEN LEFT(${col}::text, 10) ~ '^\\d{2}\\.\\d{2}\\.\\d{4}$' THEN to_date(LEFT(${col}::text, 10), 'DD.MM.YYYY')
    WHEN LEFT(${col}::text, 10) ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(LEFT(${col}::text, 10), 'YYYY-MM-DD')
    WHEN LEFT(${col}::text, 8) ~ '^\\d{8}$' THEN to_date(LEFT(${col}::text, 8), 'YYYYMMDD')
    ELSE NULL
  END
`;

(async () => {
  const client = new Client({
    connectionString:
      process.env.DIRECT_DATABASE_URL ||
      process.env.REMOTE_DATABASE_URL ||
      process.env.DATABASE_URL,
  });
  await client.connect();

  try {
    for (const table of tables) {
      for (const col of columns) {
        const sql = `
          UPDATE ${table}
          SET ${col} = to_char(parsed.parsed_date, 'YYYY-MM-DD')
          FROM (
            SELECT uuid, ${dateExpr(col)} AS parsed_date
            FROM ${table}
          ) parsed
          WHERE ${table}.uuid = parsed.uuid
            AND parsed.parsed_date IS NOT NULL
            AND (${table}.${col} IS NULL OR ${table}.${col}::text <> to_char(parsed.parsed_date, 'YYYY-MM-DD'))
        `;
        const res = await client.query(sql);
        console.log(`${table}.${col}: ${res.rowCount} updated`);
      }
    }
  } finally {
    await client.end();
  }
})();
