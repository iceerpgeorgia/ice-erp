const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

client.connect().then(async () => {
  // Find the specific project(s) matching "Holiday Inn | 1.1.1 | ლაიქ ჰაუსი"
  const projRes = await client.query(`
    SELECT project_uuid, project_name, project_index
    FROM projects proj
    WHERE project_name ILIKE '%Holiday Inn%' OR project_name ILIKE '%ლაიქ ჰაუსი%'
    ORDER BY project_name
  `);
  console.log('=== PROJECTS ===');
  projRes.rows.forEach(r => {
    console.log(`uuid=${r.project_uuid} | name=${r.project_name} | index=${r.project_index}`);
  });

  // Check all accrual_source values in payments for this project
  const srcRes = await client.query(`
    SELECT DISTINCT p.accrual_source, p.is_project_derived,
           COUNT(*) as cnt,
           (SELECT code FROM currencies curr2 WHERE curr2.uuid = p.currency_uuid) as currency_code
    FROM payments p
    WHERE p.project_uuid IN (
      SELECT project_uuid FROM projects 
      WHERE project_name ILIKE '%Holiday Inn%' OR project_name ILIKE '%ლაიქ ჰაუსი%'
    )
    GROUP BY p.accrual_source, p.is_project_derived, p.currency_uuid
    ORDER BY cnt DESC
  `);
  console.log('\n=== ACCRUAL SOURCES ===');
  srcRes.rows.forEach(r => {
    console.log(`accrual_source=${r.accrual_source} | is_project_derived=${r.is_project_derived} | currency=${r.currency_code} | count=${r.cnt}`);
  });

  // Find the specific project with index 1.1.1
  const proj111 = await client.query(`
    SELECT project_uuid, project_name, project_index
    FROM projects
    WHERE project_index = '1.1.1' OR project_name ILIKE '%ლაიქ ჰაუსი%'
  `);
  console.log('\n=== PROJECT INDEX 1.1.1 / ლაიქ ჰაუსი ===');
  proj111.rows.forEach(r => {
    console.log(`uuid=${r.project_uuid} | name=${r.project_name} | index=${r.project_index}`);
  });

  if (proj111.rows.length > 0) {
    const pUuids = proj111.rows.map(r => r.project_uuid);
    // Get all payments for this specific project
    const pRes = await client.query(`
      SELECT p.id, p.payment_id, p.accrual_source, p.is_project_derived,
             p.label, p.created_at,
             (SELECT code FROM currencies WHERE uuid = p.currency_uuid) as currency,
             (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as ledger_cnt,
             (SELECT COALESCE(SUM(pl.accrual),0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as total_accrual,
             (SELECT COALESCE(SUM(pl."order"),0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as total_order
      FROM payments p
      WHERE p.project_uuid = ANY($1::uuid[])
      ORDER BY p.currency_uuid, p.created_at, p.id
    `, [pUuids]);
    console.log('\n=== ALL PAYMENTS FOR 1.1.1 ===');
    pRes.rows.forEach(r => {
      console.log(`id=${r.id} | payment_id=${r.payment_id} | currency=${r.currency} | accrual_source=${r.accrual_source} | derived=${r.is_project_derived} | label=${r.label} | ledger_cnt=${r.ledger_cnt} | accrual=${r.total_accrual} | order=${r.total_order} | created=${new Date(r.created_at).toISOString().split('T')[0]}`);
    });
  }

  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
