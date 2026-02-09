require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const ACCOUNT_NUMBER = 'GE78BG0000000893486000';
const TABLE_NAME = '"GE78BG0000000893486000_BOG_GEL"';

(async () => {
  const client = new Client({
    connectionString:
      process.env.DIRECT_DATABASE_URL ||
      process.env.REMOTE_DATABASE_URL ||
      process.env.DATABASE_URL,
  });
  await client.connect();

  try {
    const currencyRes = await client.query(
      `SELECT uuid FROM currencies WHERE code = 'GEL' LIMIT 1`
    );
    if (currencyRes.rows.length === 0) {
      throw new Error('GEL currency not found');
    }
    const gelCurrencyUuid = currencyRes.rows[0].uuid;

    const bankRes = await client.query(
      `SELECT uuid, currency_uuid
       FROM bank_accounts
       WHERE account_number = $1`,
      [ACCOUNT_NUMBER]
    );

    const usdAccount = bankRes.rows.find((row) => row.currency_uuid !== gelCurrencyUuid);
    const gelAccount = bankRes.rows.find((row) => row.currency_uuid === gelCurrencyUuid);

    if (!gelAccount) {
      throw new Error('GEL bank account not found for this account number');
    }

    if (!usdAccount) {
      console.log('No non-GEL bank account found to update.');
      return;
    }

    const updateRes = await client.query(
      `UPDATE ${TABLE_NAME}
       SET bank_account_uuid = $1::uuid,
           account_currency_uuid = $2::uuid,
           nominal_currency_uuid = $2::uuid
       WHERE bank_account_uuid = $3::uuid`,
      [gelAccount.uuid, gelCurrencyUuid, usdAccount.uuid]
    );

    console.log(`Updated ${updateRes.rowCount} rows to GEL.`);
  } finally {
    await client.end();
  }
})();
