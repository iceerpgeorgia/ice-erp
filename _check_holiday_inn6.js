const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres'
});

const PROJECT_UUID = '2702712b-a1e7-43fa-8c75-f84d4bd6d43f';

client.connect().then(async () => {
  // Check financial_codes columns
  const fcColRes = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name='financial_codes' ORDER BY ordinal_position
  `);
  console.log('=== FINANCIAL_CODES COLUMNS ===');
  fcColRes.rows.forEach(r => console.log(r.column_name));

  // Get all financial codes to find income-type ones
  const fcRes = await client.query(`SELECT * FROM financial_codes ORDER BY code LIMIT 50`);
  console.log('\n=== FINANCIAL CODES (first 50) ===');
  if (fcRes.rows.length > 0) {
    const keys = Object.keys(fcRes.rows[0]);
    fcRes.rows.forEach(r => {
      const vals = keys.map(k => `${k}=${r[k]}`).join(' | ');
      console.log(vals);
    });
  }

  // Get payments for this project grouped by financial_code, showing income vs expense
  const groupRes = await client.query(`
    SELECT 
      p.financial_code_uuid,
      p.is_bundle_payment,
      (SELECT code FROM currencies WHERE uuid = p.currency_uuid) as currency,
      COUNT(*) as cnt,
      STRING_AGG(p.id::text, ',' ORDER BY p.id) as payment_ids,
      STRING_AGG(p.payment_id, ',' ORDER BY p.id) as payment_ids_str
    FROM payments p
    WHERE p.project_uuid = $1
    GROUP BY p.financial_code_uuid, p.is_bundle_payment, p.currency_uuid
    ORDER BY cnt DESC
  `, [PROJECT_UUID]);
  console.log('\n=== PAYMENTS GROUPED BY FC + BUNDLE STATUS ===');
  groupRes.rows.forEach(r => {
    console.log(`fc_uuid=${r.financial_code_uuid} | bundle=${r.is_bundle_payment} | currency=${r.currency} | cnt=${r.cnt} | ids=${r.payment_ids.substring(0,100)}`);
  });

  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
