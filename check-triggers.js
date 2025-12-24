const { Client } = require('pg');

async function checkTriggers() {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  await local.connect();
  
  // Check if trigger exists
  const triggers = await local.query(`
    SELECT tgname, tgtype, tgfoid::regproc 
    FROM pg_trigger 
    WHERE tgrelid = 'projects'::regclass
  `);
  
  console.log('Project triggers:');
  console.log(triggers.rows);
  
  // Check if function exists
  const functions = await local.query(`
    SELECT proname 
    FROM pg_proc 
    WHERE proname = 'populate_project_index'
  `);
  
  console.log('\nFunction exists:');
  console.log(functions.rows);
  
  // Try to manually trigger the update
  console.log('\nManually triggering update...');
  const update = await local.query(`
    UPDATE projects 
    SET updated_at = NOW() 
    WHERE project_name = 'TWIN TOWER'
    RETURNING project_index
  `);
  
  console.log('Project index after manual trigger:');
  console.log(update.rows[0]);
  
  await local.end();
}

checkTriggers().catch(console.error);
