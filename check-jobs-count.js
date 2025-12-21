const { Client } = require('pg');

const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';

async function checkJobsCounts() {
  const localClient = new Client({ connectionString: LOCAL });
  const supabaseClient = new Client({ connectionString: SUPABASE });
  
  try {
    await localClient.connect();
    await supabaseClient.connect();
    
    console.log('=== LOCAL Database ===');
    const localCount = await localClient.query('SELECT COUNT(*) FROM jobs');
    console.log(`Total jobs: ${localCount.rows[0].count}`);
    
    const localByBrand = await localClient.query(`
      SELECT b.name, COUNT(j.id) as job_count
      FROM brands b
      LEFT JOIN jobs j ON j.brand_uuid = b.uuid
      GROUP BY b.uuid, b.name
      ORDER BY job_count DESC, b.name
    `);
    console.log('\nJobs by brand:');
    localByBrand.rows.forEach(row => {
      if (row.job_count > 0) {
        console.log(`  ${row.name}: ${row.job_count}`);
      }
    });
    
    console.log('\n=== SUPABASE Database ===');
    const supabaseCount = await supabaseClient.query('SELECT COUNT(*) FROM jobs');
    console.log(`Total jobs: ${supabaseCount.rows[0].count}`);
    
    const supabaseByBrand = await supabaseClient.query(`
      SELECT b.name, COUNT(j.id) as job_count
      FROM brands b
      LEFT JOIN jobs j ON j.brand_uuid = b.uuid
      GROUP BY b.uuid, b.name
      ORDER BY job_count DESC, b.name
    `);
    console.log('\nJobs by brand:');
    supabaseByBrand.rows.forEach(row => {
      if (row.job_count > 0) {
        console.log(`  ${row.name}: ${row.job_count}`);
      }
    });
    
    // Check for duplicate job_uuids
    console.log('\n=== Checking for duplicates in LOCAL ===');
    const localDuplicates = await localClient.query(`
      SELECT job_uuid, COUNT(*) as count
      FROM jobs
      GROUP BY job_uuid
      HAVING COUNT(*) > 1
    `);
    if (localDuplicates.rows.length > 0) {
      console.log('Found duplicate job_uuids:');
      localDuplicates.rows.forEach(row => {
        console.log(`  ${row.job_uuid}: ${row.count} records`);
      });
    } else {
      console.log('No duplicates found');
    }
    
    console.log('\n=== Checking for duplicates in SUPABASE ===');
    const supabaseDuplicates = await supabaseClient.query(`
      SELECT job_uuid, COUNT(*) as count
      FROM jobs
      GROUP BY job_uuid
      HAVING COUNT(*) > 1
    `);
    if (supabaseDuplicates.rows.length > 0) {
      console.log('Found duplicate job_uuids:');
      supabaseDuplicates.rows.forEach(row => {
        console.log(`  ${row.job_uuid}: ${row.count} records`);
      });
    } else {
      console.log('No duplicates found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await localClient.end();
    await supabaseClient.end();
  }
}

checkJobsCounts();
