const { Client } = require('pg');
const fs = require('fs');
const migration = fs.readFileSync('prisma/migrations/20260422120000_add_is_recurring_to_payments/migration.sql','utf8');
async function run(name, cs) {
  const c = new Client({ connectionString: cs });
  try {
    await c.connect();
    await c.query(migration);
    console.log(name, 'OK');
  } catch(e) { console.error(name, 'ERROR', e.message); }
  finally { try { await c.end(); } catch{} }
}
(async()=>{
  await run('LOCAL', 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP');
  await run('SUPABASE', 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres');
})();
