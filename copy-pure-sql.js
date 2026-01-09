const { Client } = require('pg');

async function main() {
  const supabase = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });
  
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });

  try {
    console.log('Connecting...');
    await supabase.connect();
    await local.connect();
    
    console.log('Fetching from Supabase...');
    const result = await supabase.query('SELECT * FROM bank_accounts ORDER BY created_at');
    console.log(`Found ${result.rows.length} accounts`);
    
    console.log('\nClearing local...');
    await local.query('TRUNCATE bank_accounts RESTART IDENTITY CASCADE');
    
    console.log('Copying to local...');
    for (const acc of result.rows) {
      await local.query(`
        INSERT INTO bank_accounts (
          id, uuid, account_number, currency_uuid, is_active, created_at, updated_at, bank_uuid,
          balance, balance_date, parsing_scheme_uuid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        acc.id, acc.uuid, acc.account_number, acc.currency_uuid, acc.is_active,
        acc.created_at, acc.updated_at, acc.bank_uuid,
        acc.balance, acc.balance_date, acc.parsing_scheme_uuid
      ]);
    }
    
    console.log(`✓ Copied ${result.rows.length} accounts`);
    
    const maxId = Math.max(...result.rows.map(a => Number(a.id)));
    await local.query(`SELECT setval('bank_accounts_id_seq', $1, true)`, [maxId]);
    console.log(`✓ Reset sequence to ${maxId}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await supabase.end();
    await local.end();
  }
}

main();
