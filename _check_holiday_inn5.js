const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

const PROJECT_UUID = '2702712b-a1e7-43fa-8c75-f84d4bd6d43f';

client.connect().then(async () => {
  // Check the payments table columns
  const colRes = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'payments'
    ORDER BY ordinal_position
  `);
  console.log('=== PAYMENTS TABLE COLUMNS ===');
  colRes.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

  // Look at the Apr 14 zero-ledger payments (raw columns)
  const newRes = await client.query(`SELECT * FROM payments WHERE id IN (6118, 6119, 6120, 6121, 6122, 6123) ORDER BY id`);
  console.log('\n=== APR 14 ZERO-LEDGER PAYMENTS (raw) ===');
  newRes.rows.forEach(r => {
    const keys = Object.keys(r);
    keys.forEach(k => { if (r[k] !== null) console.log(`  ${k}: ${r[k]}`); });
    console.log('---');
  });

  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
