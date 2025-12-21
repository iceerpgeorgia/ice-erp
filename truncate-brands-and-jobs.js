const { Client } = require('pg');

// Database connections
const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';

async function truncateTables() {
  const localClient = new Client({ connectionString: LOCAL });
  const supabaseClient = new Client({ connectionString: SUPABASE });
  
  try {
    await localClient.connect();
    await supabaseClient.connect();
    
    // Truncate LOCAL
    console.log('=== Truncating LOCAL tables ===');
    await localClient.query('TRUNCATE TABLE jobs CASCADE');
    await localClient.query('TRUNCATE TABLE brands CASCADE');
    const localJobsCount = await localClient.query('SELECT COUNT(*) FROM jobs');
    const localBrandsCount = await localClient.query('SELECT COUNT(*) FROM brands');
    console.log(`LOCAL - Jobs: ${localJobsCount.rows[0].count}, Brands: ${localBrandsCount.rows[0].count}`);
    
    // Truncate SUPABASE
    console.log('\n=== Truncating SUPABASE tables ===');
    await supabaseClient.query('TRUNCATE TABLE jobs CASCADE');
    await supabaseClient.query('TRUNCATE TABLE brands CASCADE');
    const supabaseJobsCount = await supabaseClient.query('SELECT COUNT(*) FROM jobs');
    const supabaseBrandsCount = await supabaseClient.query('SELECT COUNT(*) FROM brands');
    console.log(`SUPABASE - Jobs: ${supabaseJobsCount.rows[0].count}, Brands: ${supabaseBrandsCount.rows[0].count}`);
    
    console.log('\n=== Done ===');
    
  } catch (error) {
    console.error('Error truncating tables:', error);
    throw error;
  } finally {
    await localClient.end();
    await supabaseClient.end();
  }
}

truncateTables();
