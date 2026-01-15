const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkRecord() {
  const client = await pool.connect();
  
  try {
    console.log('Checking record 525977...\n');
    
    const result = await client.query(`
      SELECT 
        cba.id,
        cba.payment_id,
        cba.account_currency_uuid,
        cba.account_currency_amount,
        cba.nominal_currency_uuid,
        cba.nominal_amount,
        cba.transaction_date,
        acc_curr.code as account_currency_code,
        nom_curr.code as nominal_currency_code,
        p.currency_uuid as payment_currency_uuid,
        pay_curr.code as payment_currency_code
      FROM consolidated_bank_accounts cba
      LEFT JOIN currencies acc_curr ON cba.account_currency_uuid = acc_curr.uuid
      LEFT JOIN currencies nom_curr ON cba.nominal_currency_uuid = nom_curr.uuid
      LEFT JOIN payments p ON cba.payment_id = p.payment_id
      LEFT JOIN currencies pay_curr ON p.currency_uuid = pay_curr.uuid
      WHERE cba.id = 525977
    `);
    
    if (result.rows.length === 0) {
      console.log('Record not found');
      return;
    }
    
    const record = result.rows[0];
    console.log('Record details:');
    console.log(JSON.stringify(record, null, 2));
    
    console.log('\nAnalysis:');
    console.log(`Account currency: ${record.account_currency_code} (${record.account_currency_uuid})`);
    console.log(`Account amount: ${record.account_currency_amount}`);
    console.log(`Nominal currency: ${record.nominal_currency_code} (${record.nominal_currency_uuid})`);
    console.log(`Nominal amount: ${record.nominal_amount}`);
    console.log(`Payment ID: ${record.payment_id}`);
    console.log(`Payment currency: ${record.payment_currency_code} (${record.payment_currency_uuid})`);
    
    console.log('\nIssue check:');
    if (record.payment_id && record.payment_currency_uuid) {
      if (record.nominal_currency_uuid !== record.payment_currency_uuid) {
        console.log('❌ MISMATCH: Nominal currency does not match payment currency!');
        console.log(`   Nominal: ${record.nominal_currency_code}`);
        console.log(`   Payment: ${record.payment_currency_code}`);
      } else {
        console.log('✓ Nominal currency matches payment currency');
      }
      
      if (record.nominal_amount == record.account_currency_amount && 
          record.account_currency_code !== record.payment_currency_code) {
        console.log('❌ PROBLEM: Nominal amount equals account amount but currencies differ!');
        console.log('   This suggests amount was not recalculated');
      } else {
        console.log('✓ Amounts appear to be properly calculated');
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkRecord().catch(console.error);
