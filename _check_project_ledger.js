const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres' });
client.connect().then(async () => {
  const r = await client.query(`
    SELECT pl.id, pl.payment_id, pl.effective_date, pl.accrual, pl."order", pl.comment, pl.is_deleted,
           (SELECT r.payment_id FROM consolidated_bank_accounts r WHERE r.payment_id = pl.payment_id LIMIT 1) as has_bank_tx
    FROM payments_ledger pl
    WHERE pl.payment_id = '64d308_fb_b66a8a'
    ORDER BY pl.effective_date
  `);
  console.log('LEDGER ENTRIES FOR payment 64d308_fb_b66a8a (FC 2.1.1.3.1, USD):');
  r.rows.forEach(x => console.log(`  ledger_id=${x.id} | date=${x.effective_date ? new Date(x.effective_date).toISOString().split('T')[0] : null} | accrual=${x.accrual} | order=${x.order} | is_deleted=${x.is_deleted} | comment=${x.comment}`));
  await client.end();
});
