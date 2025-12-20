const { Client } = require('pg');

(async () => {
  console.log('=== LOCAL DATABASE ===');
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  await local.connect();
  const localSchema = await local.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'project_employees' 
    ORDER BY ordinal_position
  `);
  localSchema.rows.forEach(col => console.log(`  ${col.column_name} - ${col.data_type}`));
  await local.end();

  console.log('\n=== SUPABASE DATABASE ===');
  const remote = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });
  await remote.connect();
  const remoteSchema = await remote.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'project_employees' 
    ORDER BY ordinal_position
  `);
  remoteSchema.rows.forEach(col => console.log(`  ${col.column_name} - ${col.data_type}`));
  await remote.end();
})();
