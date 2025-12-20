const { Client } = require('pg');

(async () => {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  const remote = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });

  await local.connect();
  await remote.connect();

  console.log('📊 Fetching project employees from local...');
  const employees = await local.query(`
    SELECT 
      pe.employee_uuid,
      p.project_uuid
    FROM project_employees pe
    JOIN projects p ON pe.project_id = p.id
    ORDER BY pe.id
  `);
  
  console.log(`Found ${employees.rows.length} project_employees in local DB`);

  let synced = 0;
  for (const emp of employees.rows) {
    if (!emp.project_uuid) {
      console.log(`⚠️ Skipping employee ${emp.employee_uuid} - no project_uuid mapping`);
      continue;
    }
    
    await remote.query(
      `INSERT INTO project_employees (project_uuid, employee_uuid)
       VALUES ($1, $2)
       ON CONFLICT (project_uuid, employee_uuid) DO NOTHING`,
      [emp.project_uuid, emp.employee_uuid]
    );
    synced++;
    if (synced % 50 === 0) {
      console.log(`  Synced ${synced}/${employees.rows.length}...`);
    }
  }

  console.log('✅ Sync complete!');
  
  const verify = await remote.query('SELECT COUNT(*) FROM project_employees');
  console.log(`Supabase now has ${verify.rows[0].count} project_employees`);

  await local.end();
  await remote.end();
})();
