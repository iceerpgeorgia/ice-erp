const { Client } = require('pg');

async function alterJobsTable(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Altering jobs table in ${dbName} ===`);
    
    // Add brand_uuid column
    await client.query(`
      ALTER TABLE jobs 
      ADD COLUMN brand_uuid UUID;
    `);
    console.log('Added brand_uuid column');
    
    // Drop the old brand_id column
    await client.query(`
      ALTER TABLE jobs 
      DROP COLUMN brand_id;
    `);
    console.log('Dropped brand_id column');
    
    // Add foreign key constraint (optional, but recommended)
    await client.query(`
      ALTER TABLE jobs
      ADD CONSTRAINT fk_jobs_brand_uuid 
      FOREIGN KEY (brand_uuid) REFERENCES brands(uuid);
    `);
    console.log('Added foreign key constraint on brand_uuid');
    
    console.log(`✓ Successfully altered jobs table in ${dbName}`);
    
  } catch (error) {
    console.error(`Error altering ${dbName}:`, error.message);
  } finally {
    await client.end();
  }
}

// Run for both databases
(async () => {
  const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  
  await alterJobsTable(LOCAL, 'LOCAL');
  await alterJobsTable(SUPABASE, 'SUPABASE');
  
  console.log('\n=== Done ===');
})();
