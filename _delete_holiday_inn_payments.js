const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

const TARGET_PAYMENT_IDS = ['3a5bf5_88_af9707', '51d5f5_38_84fae2', 'a84fd3_f9_a0cdfc'];
const TARGET_IDS = [348, 493, 1028];

client.connect().then(async () => {
  // Step 1: Delete ledger entries
  const ledgerDel = await client.query(
    `DELETE FROM payments_ledger WHERE payment_id = ANY($1) RETURNING id, payment_id, accrual`,
    [TARGET_PAYMENT_IDS]
  );
  console.log(`Deleted ${ledgerDel.rows.length} ledger entries:`);
  ledgerDel.rows.forEach(r => console.log(`  ledger id=${r.id} | payment_id=${r.payment_id} | accrual=${r.accrual}`));

  // Step 2: Delete payments
  const paymentDel = await client.query(
    `DELETE FROM payments WHERE id = ANY($1) RETURNING id, payment_id`,
    [TARGET_IDS]
  );
  console.log(`\nDeleted ${paymentDel.rows.length} payments:`);
  paymentDel.rows.forEach(r => console.log(`  payment id=${r.id} | payment_id=${r.payment_id}`));

  console.log('\nDone.');
  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
