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

  const raw = await client.query(
    `SELECT uuid, dockey, entriesid, docvaluedate, docrecdate, docactualdate, entrypdate
     FROM bog_gel_raw_893486000
     WHERE uuid = $1`,
    ['530903bf-eb4f-4be0-b986-c8843e767552']
  );

  const dec = await client.query(
    `SELECT id, uuid, dockey, entriesid, transaction_date, docvaluedate, docrecdate, docactualdate, entrypdate
     FROM "GE78BG0000000893486000_BOG_GEL"
     WHERE id = $1`,
    [37053]
  );

  console.log({ raw: raw.rows[0], deconsolidated: dec.rows[0] });
  await client.end();
})();
