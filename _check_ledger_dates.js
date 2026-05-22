const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres:fulebimojviT1985%25@db.fojbzghphznbslqwurrm.supabase.co:5432/postgres' });
(async () => {
  const r = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='payments_ledger' AND column_name='effective_date'`);
  console.log('COLUMN:', JSON.stringify(r.rows));
  const r2 = await p.query(`SELECT id, payment_id, effective_date, effective_date::text AS as_text, created_at FROM payments_ledger ORDER BY id DESC LIMIT 8`);
  console.log('RECENT:', JSON.stringify(r2.rows, null, 2));
  await p.end();
})();
