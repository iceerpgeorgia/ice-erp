const { Client } = require('pg');

async function truncateJobs(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Truncating jobs table in ${dbName} ===`);
    
    // Truncate the jobs table
    await client.query('TRUNCATE TABLE jobs RESTART IDENTITY CASCADE;');
    
    console.log(`Successfully truncated jobs table in ${dbName}`);
    
    // Check count
    const result = await client.query('SELECT COUNT(*) FROM jobs');
    console.log(`Jobs count: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error(`Error truncating ${dbName}:`, error.message);
  } finally {
    await client.end();
  }
}

// Run for both databases
(async () => {
  const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  
  await truncateJobs(LOCAL, 'LOCAL');
  await truncateJobs(SUPABASE, 'SUPABASE');
  
  console.log('\n=== Done ===');
})();
