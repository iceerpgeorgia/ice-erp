const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

const PROJECT_UUID = '2702712b-a1e7-43fa-8c75-f84d4bd6d43f';

client.connect().then(async () => {
  // All payments for the specific project
  const pRes = await client.query(`
    SELECT p.id, p.payment_id, p.accrual_source, p.is_project_derived,
           p.label, p.created_at, p.is_active, p.record_uuid,
           (SELECT code FROM currencies WHERE uuid = p.currency_uuid) as currency,
           (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as ledger_cnt,
           (SELECT COALESCE(SUM(pl.accrual),0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as total_accrual
    FROM payments p
    WHERE p.project_uuid = $1
    ORDER BY p.is_project_derived DESC NULLS LAST, p.accrual_source, p.currency_uuid, p.created_at, p.id
  `, [PROJECT_UUID]);
  
  console.log(`Total payments: ${pRes.rows.length}`);
  console.log('\n=== IS_PROJECT_DERIVED = TRUE ===');
  pRes.rows.filter(r => r.is_project_derived).forEach(r => {
    console.log(`id=${r.id} | payment_id=${r.payment_id} | currency=${r.currency} | accrual_source=${r.accrual_source} | label=${r.label} | ledger_cnt=${r.ledger_cnt} | accrual=${r.total_accrual} | active=${r.is_active} | created=${new Date(r.created_at).toISOString().split('T')[0]}`);
  });

  // Check all distinct accrual_source values across whole system
  const allSrc = await client.query(`
    SELECT DISTINCT accrual_source FROM payments WHERE accrual_source IS NOT NULL ORDER BY 1
  `);
  console.log('\n=== ALL ACCRUAL_SOURCE VALUES IN SYSTEM ===');
  allSrc.rows.forEach(r => console.log(r.accrual_source));

  // Look for any "income" type payments for this project (checking payment_id patterns)
  const incomeRes = await client.query(`
    SELECT p.id, p.payment_id, p.accrual_source, p.is_project_derived,
           p.label, p.created_at, p.is_active,
           (SELECT code FROM currencies WHERE uuid = p.currency_uuid) as currency,
           (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as ledger_cnt,
           (SELECT COALESCE(SUM(pl.accrual),0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as total_accrual
    FROM payments p
    WHERE p.project_uuid = $1
      AND (p.accrual_source IS NOT NULL OR p.is_project_derived = true OR p.label IS NOT NULL)
    ORDER BY p.created_at, p.id
  `, [PROJECT_UUID]);
  
  console.log('\n=== NON-NULL accrual_source / derived / labeled PAYMENTS ===');
  incomeRes.rows.forEach(r => {
    console.log(`id=${r.id} | payment_id=${r.payment_id} | currency=${r.currency} | accrual_source=${r.accrual_source} | derived=${r.is_project_derived} | label=${r.label} | ledger_cnt=${r.ledger_cnt} | accrual=${r.total_accrual} | active=${r.is_active} | created=${new Date(r.created_at).toISOString().split('T')[0]}`);
  });

  // Payments created on the same day (potential duplicates)
  const dupRes = await client.query(`
    SELECT DATE(p.created_at) as day,
           (SELECT code FROM currencies WHERE uuid = p.currency_uuid) as currency,
           COUNT(*) as cnt,
           STRING_AGG(p.payment_id, ', ' ORDER BY p.id) as payment_ids,
           STRING_AGG(p.id::text, ', ' ORDER BY p.id) as ids
    FROM payments p
    WHERE p.project_uuid = $1
    GROUP BY DATE(p.created_at), p.currency_uuid
    HAVING COUNT(*) > 1
    ORDER BY day, currency
  `, [PROJECT_UUID]);
  
  console.log('\n=== DAYS WITH MULTIPLE PAYMENTS CREATED (potential duplicates) ===');
  dupRes.rows.forEach(r => {
    console.log(`day=${r.day} | currency=${r.currency} | count=${r.cnt} | ids=${r.ids}`);
  });

  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
