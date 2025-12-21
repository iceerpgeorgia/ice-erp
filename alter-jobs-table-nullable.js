const { Client } = require('pg');

async function alterTable(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Altering ${dbName} ===`);
    
    // Alter floors and weight to allow NULL
    await client.query(`
      ALTER TABLE jobs 
      ALTER COLUMN floors DROP NOT NULL,
      ALTER COLUMN weight DROP NOT NULL;
    `);
    
    console.log(`Successfully altered jobs table in ${dbName}`);
    
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
  
  await alterTable(LOCAL, 'LOCAL');
  await alterTable(SUPABASE, 'SUPABASE');
  
  console.log('\n=== Done altering tables ===');
})();
