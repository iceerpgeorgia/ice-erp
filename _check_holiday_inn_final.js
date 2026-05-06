const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

const TARGET_PAYMENT_IDS = ['3a5bf5_88_af9707', '51d5f5_38_84fae2', 'a84fd3_f9_a0cdfc'];
const TARGET_IDS = [348, 493, 1028];

client.connect().then(async () => {
  console.log('=== PAYMENTS TO DELETE ===');
  const pRes = await client.query(`SELECT * FROM payments WHERE id = ANY($1)`, [TARGET_IDS]);
  pRes.rows.forEach(r => console.log(`id=${r.id} | payment_id=${r.payment_id} | bundle=${r.is_bundle_payment} | is_active=${r.is_active}`));

  console.log('\n=== LEDGER ENTRIES TO DELETE ===');
  const plRes = await client.query(`
    SELECT pl.id, pl.payment_id, pl.effective_date, pl.accrual, pl."order", pl.comment
    FROM payments_ledger pl
    WHERE pl.payment_id = ANY($1)
    ORDER BY pl.payment_id, pl.effective_date
  `, [TARGET_PAYMENT_IDS]);
  plRes.rows.forEach(r => {
    console.log(`ledger_id=${r.id} | payment_id=${r.payment_id} | date=${r.effective_date ? new Date(r.effective_date).toISOString().split('T')[0] : 'null'} | accrual=${r.accrual} | order=${r.order} | comment=${r.comment}`);
  });
  console.log(`Total ledger entries: ${plRes.rows.length}`);

  // Check all other tables that might reference payment_id or record_uuid
  const tables = ['payment_notifications', 'payment_attachments', 'bank_transaction_batches', 'consolidated_bank_accounts'];
  for (const t of tables) {
    try {
      const chk = await client.query(`SELECT COUNT(*) as cnt FROM ${t} WHERE payment_id = ANY($1)`, [TARGET_PAYMENT_IDS]);
      console.log(`\n${t}: ${chk.rows[0].cnt} references`);
    } catch(e) {
      // Check if table exists
      try {
        const chk2 = await client.query(`SELECT COUNT(*) as cnt FROM ${t}`);
        console.log(`\n${t}: no payment_id column (total rows: ${chk2.rows[0].cnt})`);
      } catch(e2) {
        console.log(`\n${t}: table does not exist`);
      }
    }
  }

  // Check attachments specifically with record_uuid
  try {
    const attRes = await client.query(`
      SELECT * FROM payment_attachments WHERE payment_id = ANY($1)
    `, [TARGET_PAYMENT_IDS]);
    console.log(`\npayment_attachments: ${attRes.rows.length} rows`);
    attRes.rows.forEach(r => console.log(`  attachment id=${r.id} | payment_id=${r.payment_id} | filename=${r.filename}`));
  } catch(e) {
    console.log(`payment_attachments error: ${e.message}`);
  }

  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
