const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
});

async function checkRecord() {
  await client.connect();
  
  const result = await client.query(`
    SELECT id, date, description, payment_uuid, counteragent_uuid, id_1, id_2 
    FROM consolidated_bank_accounts 
    WHERE id_1 = '31117184347' AND id_2 = '108518127520'
  `);
  
  console.log(JSON.stringify(result.rows, null, 2));
  
  await client.end();
}

checkRecord();
