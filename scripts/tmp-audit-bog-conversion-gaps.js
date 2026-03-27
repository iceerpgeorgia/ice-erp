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

    const report = [];
    const totals = {
      tables: 0,
      fxRows: 0,
      fxRowsMissingConversion: 0,
      fxRowsWithConversion: 0,
    };

    for (const row of tablesRes.rows) {
      const table = row.table_name;

      const counts = await client.query(
        `SELECT
           COUNT(*) FILTER (WHERE COALESCE(UPPER(docsrcccy), '') <> COALESCE(UPPER(docdstccy), '')) AS fx_rows,
           COUNT(*) FILTER (
             WHERE COALESCE(UPPER(docsrcccy), '') <> COALESCE(UPPER(docdstccy), '')
               AND conversion_id IS NULL
           ) AS fx_rows_missing_conversion,
           COUNT(*) FILTER (
             WHERE COALESCE(UPPER(docsrcccy), '') <> COALESCE(UPPER(docdstccy), '')
               AND conversion_id IS NOT NULL
           ) AS fx_rows_with_conversion
         FROM "${table}"`
      );

      const fxRows = Number(counts.rows[0].fx_rows || 0);
      const missing = Number(counts.rows[0].fx_rows_missing_conversion || 0);
      const withConv = Number(counts.rows[0].fx_rows_with_conversion || 0);

      let sample = [];
      if (missing > 0) {
        const sampleRes = await client.query(
          `SELECT id, uuid, dockey, entriesid, transaction_date, docsenderacctno, docbenefacctno,
                  docsrcamt, docsrcccy, docdstamt, docdstccy, account_currency_amount, description
           FROM "${table}"
           WHERE COALESCE(UPPER(docsrcccy), '') <> COALESCE(UPPER(docdstccy), '')
             AND conversion_id IS NULL
           ORDER BY transaction_date DESC, id DESC
           LIMIT 20`
        );
        sample = sampleRes.rows;
      }

      report.push({
        table,
        fxRows,
        fxRowsMissingConversion: missing,
        fxRowsWithConversion: withConv,
        sample,
      });

      totals.tables += 1;
      totals.fxRows += fxRows;
      totals.fxRowsMissingConversion += missing;
      totals.fxRowsWithConversion += withConv;
    }

    console.log(JSON.stringify({ totals, report }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});