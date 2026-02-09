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
  const res = await client.query(
    'SELECT COUNT(*)::int AS missing_count FROM bog_gel_raw_893486000 r LEFT JOIN "GE78BG0000000893486000_BOG_GEL" d ON r.dockey = d.dockey AND r.entriesid = d.entriesid WHERE d.dockey IS NULL'
  );
  console.log(res.rows[0].missing_count);
  await client.end();
})();
