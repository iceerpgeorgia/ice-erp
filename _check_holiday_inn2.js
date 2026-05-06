const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

client.connect().then(async () => {
  // Find payments matching the description: Holiday Inn project, USD, income, 10.02.2022
  const res = await client.query(`
    SELECT p.id, p.payment_id, p.record_uuid,
           p.accrual_source, p.label,
           p.created_at, p.is_active,
           p.is_project_derived,
           curr.code as currency_code,
           proj.project_name, proj.project_index,
           (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as ledger_count,
           (SELECT COALESCE(SUM(pl.accrual),0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as total_accrual
    FROM payments p
    LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
    LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
    WHERE (proj.project_name ILIKE '%Holiday Inn%' OR proj.project_name ILIKE '%ლაიქ ჰაუსი%')
      AND curr.code = 'USD'
    ORDER BY p.created_at, p.id
  `);
  
  console.log('=== ALL USD PAYMENTS FOR HOLIDAY INN PROJECT ===');
  res.rows.forEach(r => {
    console.log(`id=${r.id} | payment_id=${r.payment_id} | accrual_source=${r.accrual_source} | label=${r.label} | ledger_count=${r.ledger_count} | total_accrual=${r.total_accrual} | created=${r.created_at}`);
  });

  // More specifically look for income source payments
  const incomeRes = await client.query(`
    SELECT p.id, p.payment_id, p.record_uuid, p.accrual_source, p.label, p.created_at,
           curr.code as currency_code, proj.project_name
    FROM payments p
    LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
    LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
    WHERE (proj.project_name ILIKE '%Holiday Inn%' OR proj.project_name ILIKE '%ლაიქ ჰაუსი%')
      AND curr.code = 'USD'
      AND p.accrual_source ILIKE '%income%'
    ORDER BY p.created_at, p.id
  `);
  
  console.log('\n=== INCOME SOURCE PAYMENTS ===');
  incomeRes.rows.forEach(r => {
    console.log(`id=${r.id} | payment_id=${r.payment_id} | accrual_source=${r.accrual_source} | label=${r.label} | created=${r.created_at}`);
  });

  // Also check for payments with ledger entries summing to ~372497
  const largeRes = await client.query(`
    SELECT p.id, p.payment_id, p.accrual_source, p.label,
           pl.id as ledger_id, pl.effective_date, pl.accrual, pl."order", pl.comment
    FROM payments p
    JOIN payments_ledger pl ON pl.payment_id = p.payment_id
    LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
    LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
    WHERE (proj.project_name ILIKE '%Holiday Inn%' OR proj.project_name ILIKE '%ლაიქ ჰაუსი%')
      AND curr.code = 'USD'
      AND (pl.accrual > 100000 OR pl."order" > 100000)
    ORDER BY pl.accrual DESC NULLS LAST
  `);
  
  console.log('\n=== LARGE LEDGER ENTRIES (>100k) ===');
  largeRes.rows.forEach(r => {
    console.log(`payment_id=${r.payment_id} | accrual_source=${r.accrual_source} | label=${r.label} | ledger_id=${r.ledger_id} | date=${r.effective_date} | accrual=${r.accrual} | order=${r.order}`);
  });

  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
