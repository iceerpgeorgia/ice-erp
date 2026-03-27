require('dotenv/config');
const { Client } = require('pg');

async function main() {
  const cs = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!cs) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');
  const client = new Client({ connectionString: cs });
  await client.connect();
  try {
    const outliers = await client.query(`
      SELECT c.id, c.uuid, c.key_value, c.account_out_uuid, c.account_in_uuid,
             COUNT(ce.*) AS ce_count,
             STRING_AGG(COALESCE(ce.entry_type, 'NULL'), ',' ORDER BY ce.entry_type) AS entry_types
      FROM conversion c
      LEFT JOIN conversion_entries ce ON ce.conversion_uuid = c.uuid
      GROUP BY c.id, c.uuid, c.key_value, c.account_out_uuid, c.account_in_uuid
      HAVING COUNT(ce.*) <> 3
      ORDER BY c.id DESC
      LIMIT 20
    `);

    const details = [];
    for (const o of outliers.rows) {
      const entries = await client.query(
        `SELECT conversion_id, conversion_uuid, entry_type, dockey, raw_record_uuid, bank_account_uuid, account_currency_amount
         FROM conversion_entries
         WHERE conversion_uuid = $1
         ORDER BY entry_type`,
        [o.uuid]
      );
      details.push({ ...o, entries: entries.rows });
    }

    console.log(JSON.stringify({ count: outliers.rows.length, details }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});