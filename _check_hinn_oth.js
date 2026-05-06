const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres' });

const PROJECT_UUID = '6489cc6b-71ea-46f0-8165-5a6db0bdca47';

client.connect().then(async () => {
  // Project + its FC details
  const proj = await client.query(`
    SELECT p.project_name, p.project_index, p.financial_code_uuid,
           fc.code as fc_code, fc.name as fc_name, fc.is_income, fc.is_bundle, fc.automated_payment_id
    FROM projects p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE p.project_uuid = $1
  `, [PROJECT_UUID]);
  console.log('=== PROJECT FC ===');
  const r = proj.rows[0];
  console.log(`name=${r.project_name} | fc_code=${r.fc_code} | fc_name=${r.fc_name} | is_bundle=${r.is_bundle} | automated=${r.automated_payment_id}`);

  // All payments on this project
  const pmts = await client.query(`
    SELECT p.id, p.payment_id, p.is_bundle_payment, p.is_project_derived, p.is_active,
           fc.code as fc_code, fc.is_bundle as fc_is_bundle,
           (SELECT COUNT(*) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as ledger_cnt,
           (SELECT COALESCE(SUM(pl.accrual),0) FROM payments_ledger pl WHERE pl.payment_id = p.payment_id) as total_accrual
    FROM payments p
    JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    WHERE p.project_uuid = $1
    ORDER BY p.is_bundle_payment DESC, p.id
  `, [PROJECT_UUID]);
  console.log('\n=== ALL PAYMENTS ===');
  pmts.rows.forEach(r => console.log(`id=${r.id} | payment_id=${r.payment_id} | is_bundle_payment=${r.is_bundle_payment} | fc_code=${r.fc_code} | fc_is_bundle=${r.fc_is_bundle} | ledger=${r.ledger_cnt} | accrual=${r.total_accrual}`));

  await client.end();
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });
