const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres' });
const P = 'edcb4fbb-6a57-4308-93aa-8a98f148a069';
client.connect().then(async () => {
  const r = await client.query(`
    SELECT p.id, p.payment_id, p.is_active, p.is_bundle_payment, p.is_project_derived,
           (SELECT code FROM currencies WHERE uuid=p.currency_uuid) as cur,
           (SELECT code FROM financial_codes WHERE uuid=p.financial_code_uuid) as fc_code,
           (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id=p.payment_id AND COALESCE(pl.is_deleted,false)=false AND (COALESCE(pl.accrual,0)<>0 OR COALESCE(pl."order",0)<>0)) as blocking_ledger_cnt,
           (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id=p.payment_id) as total_ledger_cnt,
           (SELECT COALESCE(SUM(pl.accrual),0) FROM payments_ledger pl WHERE pl.payment_id=p.payment_id) as total_accrual
    FROM payments p WHERE p.project_uuid=$1::uuid ORDER BY p.id
  `, [P]);
  console.log('id | payment_id | active | bundle | derived | currency | fc_code | blocking_ledger | total_ledger | total_accrual');
  r.rows.forEach(x => console.log(`${x.id} | ${x.payment_id} | ${x.is_active} | ${x.is_bundle_payment} | ${x.is_project_derived} | ${x.cur} | ${x.fc_code} | ${x.blocking_ledger_cnt} | ${x.total_ledger_cnt} | ${x.total_accrual}`));
  await client.end();
});
