const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:fulebimojviT1985%@localhost:5432/ICE_ERP',
});

async function checkRecord() {
  const client = await pool.connect();
  try {
    // First, get the consolidated record
    const consolidated = await client.query(`
      SELECT * FROM consolidated_bank_accounts WHERE id = 27974
    `);
    
    if (consolidated.rows.length === 0) {
      console.log('Record not found');
      return;
    }
    
    const record = consolidated.rows[0];
    console.log('\n=== Consolidated Bank Account Record (ID 27974) ===');
    console.log(`UUID: ${record.uuid}`);
    console.log(`Raw Record UUID: ${record.raw_record_uuid}`);
    console.log(`Transaction Date: ${record.transaction_date}`);
    console.log(`Description: ${record.description}`);
    console.log(`Counteragent UUID: ${record.counteragent_uuid}`);
    console.log(`Account Amount: ${record.account_currency_amount}`);
    console.log(`Nominal Amount: ${record.nominal_amount}`);
    
    // Now check the raw table
    const raw = await client.query(`
      SELECT * FROM bog_gel_raw_893486000 WHERE uuid = $1
    `, [record.raw_record_uuid]);
    
    if (raw.rows.length > 0) {
      const rawRecord = raw.rows[0];
      console.log('\n=== Raw Table Data ===');
      console.log(JSON.stringify(rawRecord, null, 2));
    } else {
      console.log('\n⚠️ Raw record not found in local database');
      console.log('The bog_gel_raw_893486000 table might not have been copied from Supabase');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkRecord().catch(console.error);
