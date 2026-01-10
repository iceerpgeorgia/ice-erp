const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
});

async function checkNominalCurrency() {
  await client.connect();
  
  // Check account currency
  console.log('🏦 Checking account currency for GE78BG0000000893486000:');
  const accountResult = await client.query(`
    SELECT a.account_number, a.currency_uuid, c.code, c.name
    FROM bank_accounts a
    JOIN currencies c ON a.currency_uuid = c.uuid
    WHERE a.account_number = 'GE78BG0000000893486000'
  `);
  console.log(JSON.stringify(accountResult.rows, null, 2));
  
  // Check consolidated records without payment_uuid (not matched by payment or rule)
  console.log('\n💰 Checking nominal currency for records WITHOUT payment_uuid:');
  const noPaymentResult = await client.query(`
    SELECT 
      cb.id,
      cb.payment_uuid,
      cb.nominal_currency_uuid,
      c.code as nominal_currency_code,
      cb.account_currency_amount,
      cb.nominal_amount,
      cb.description
    FROM consolidated_bank_accounts cb
    LEFT JOIN currencies c ON cb.nominal_currency_uuid = c.uuid
    WHERE cb.payment_uuid IS NULL
    ORDER BY cb.id
    LIMIT 10
  `);
  console.log(JSON.stringify(noPaymentResult.rows, null, 2));
  
  // Check how many records have each currency
  console.log('\n📊 Currency distribution in consolidated_bank_accounts:');
  const distributionResult = await client.query(`
    SELECT 
      c.code,
      COUNT(*) as count,
      COUNT(CASE WHEN cb.payment_uuid IS NULL THEN 1 END) as count_no_payment
    FROM consolidated_bank_accounts cb
    LEFT JOIN currencies c ON cb.nominal_currency_uuid = c.uuid
    GROUP BY c.code
    ORDER BY count DESC
  `);
  console.log(JSON.stringify(distributionResult.rows, null, 2));
  
  await client.end();
}

checkNominalCurrency().catch(console.error);
