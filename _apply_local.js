const { Client } = require('pg');
const fs = require('fs');
const migration = fs.readFileSync('prisma/migrations/20260422120000_add_is_recurring_to_payments/migration.sql','utf8');
(async()=>{
  const c = new Client({ host:'localhost', port:5432, database:'ICE_ERP', user:'postgres', password:'fulebimojviT1985%' });
  try { await c.connect(); await c.query(migration); console.log('LOCAL OK'); }
  catch(e){ console.error('LOCAL ERROR', e.message); }
  finally { try{await c.end();}catch{} }
})();
