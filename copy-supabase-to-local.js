const { Pool } = require('pg');

const supabasePool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const localPool = new Pool({
  connectionString: 'postgresql://postgres:fulebimojviT1985%@localhost:5432/ICE_ERP',
});

async function copyData() {
  const supabaseClient = await supabasePool.connect();
  const localClient = await localPool.connect();
  
  try {
    console.log('🗑️  Truncating local consolidated_bank_accounts table...');
    await localClient.query('TRUNCATE TABLE consolidated_bank_accounts CASCADE');
    console.log('✅ Local table truncated\n');
    
    console.log('📥 Fetching records from Supabase...');
    const result = await supabaseClient.query(`
      SELECT * FROM consolidated_bank_accounts ORDER BY id
    `);
    
    console.log(`Found ${result.rows.length} records`);
    
    if (result.rows.length === 0) {
      console.log('No data to copy');
      return;
    }
    
    console.log('Copying to local database...');
    let copied = 0;
    
    for (const row of result.rows) {
      await localClient.query(`
        INSERT INTO consolidated_bank_accounts (
          uuid, bank_account_uuid, raw_record_uuid, transaction_date,
          description, counteragent_uuid, project_uuid, financial_code_uuid,
          account_currency_uuid, account_currency_amount, nominal_currency_uuid,
          nominal_amount, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (uuid) DO NOTHING
      `, [
        row.uuid, row.bank_account_uuid, row.raw_record_uuid, row.transaction_date,
        row.description, row.counteragent_uuid, row.project_uuid, row.financial_code_uuid,
        row.account_currency_uuid, row.account_currency_amount, row.nominal_currency_uuid,
        row.nominal_amount, row.created_at, row.updated_at
      ]);
      
      copied++;
      if (copied % 1000 === 0) {
        console.log(`  Copied ${copied}/${result.rows.length} records...`);
      }
    }
    
    console.log(`✅ Successfully copied ${copied} records to local database!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    supabaseClient.release();
    localClient.release();
    await supabasePool.end();
    await localPool.end();
  }
}

copyData();
