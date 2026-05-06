const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

client.connect().then(async () => {
  // Find the project first
  const projRes = await client.query(`
    SELECT project_uuid, project_name, project_index
    FROM projects
    WHERE project_name ILIKE '%Holiday Inn%' OR project_name ILIKE '%ლაიქ ჰაუსი%'
    ORDER BY project_name
  `);
  console.log('=== PROJECTS ===');
  console.log(JSON.stringify(projRes.rows, null, 2));

  if (!projRes.rows.length) { await client.end(); return; }

  const projectUuids = projRes.rows.map(r => r.project_uuid);

  // Find payments for these projects in USD
  const payRes = await client.query(`
    SELECT p.id, p.payment_id, p.record_uuid, p.accrual_source,
           p.created_at, p.is_active,
           curr.code as currency_code,
           proj.project_name, proj.project_index
    FROM payments p
    LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
    LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
    WHERE p.project_uuid = ANY($1::uuid[])
      AND curr.code = 'USD'
    ORDER BY p.created_at, p.id
  `, [projectUuids]);
  console.log('\n=== PAYMENTS (USD) ===');
  console.log(JSON.stringify(payRes.rows, null, 2));

  if (!payRes.rows.length) { await client.end(); return; }

  const paymentIds = payRes.rows.map(r => r.payment_id);

  // Find ledger entries for these payments
  const ledgerRes = await client.query(`
    SELECT pl.id, pl.payment_id, pl.effective_date, pl.accrual, pl."order",
           pl.comment, pl.user_email, pl.created_at
    FROM payments_ledger pl
    WHERE pl.payment_id = ANY($1::text[])
    ORDER BY pl.payment_id, pl.created_at
  `, [paymentIds]);
  console.log('\n=== LEDGER ENTRIES ===');
  console.log(JSON.stringify(ledgerRes.rows, null, 2));

  await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
