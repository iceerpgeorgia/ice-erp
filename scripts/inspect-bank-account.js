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
    `SELECT ba.uuid, ba.account_number, ba.currency_uuid, c.code AS currency_code
     FROM bank_accounts ba
     LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
     WHERE ba.account_number LIKE 'GE78BG0000000893486000%'
     LIMIT 5`
  );
  console.log(res.rows);
  await client.end();
})();
