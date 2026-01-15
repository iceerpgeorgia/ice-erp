const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDateFormats() {
  const client = await remotePool.connect();
  
  try {
    console.log('🔍 Analyzing dates in Supabase bog_gel_raw_893486000...\n');
    
    // Check if there are any dates from 2018-2023
    const years = await client.query(`
      SELECT 
        CASE 
          WHEN docvaluedate LIKE '%.2018' THEN '2018'
          WHEN docvaluedate LIKE '%.2019' THEN '2019'
          WHEN docvaluedate LIKE '%.2020' THEN '2020'
          WHEN docvaluedate LIKE '%.2021' THEN '2021'
          WHEN docvaluedate LIKE '%.2022' THEN '2022'
          WHEN docvaluedate LIKE '%.2023' THEN '2023'
          WHEN docvaluedate LIKE '%.2024' THEN '2024'
          WHEN docvaluedate LIKE '%.2025' THEN '2025'
          ELSE 'Other'
        END as year,
        COUNT(*) as count
      FROM bog_gel_raw_893486000
      GROUP BY year
      ORDER BY year
    `);
    
    console.log('Records by year:');
    years.rows.forEach(row => {
      console.log(`  ${row.year}: ${row.count} records`);
    });
    
    console.log('\n');
    
    // Total count
    const total = await client.query(`SELECT COUNT(*) FROM bog_gel_raw_893486000`);
    console.log(`Total records: ${total.rows[0].count}`);
    
    // Check first and last dates (properly)
    const samples = await client.query(`
      SELECT docvaluedate
      FROM bog_gel_raw_893486000
      WHERE docvaluedate IS NOT NULL
      ORDER BY docvaluedate
      LIMIT 5
    `);
    
    console.log('\nFirst 5 dates (alphabetically):');
    samples.rows.forEach(row => {
      console.log(`  ${row.docvaluedate}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await remotePool.end();
  }
}

checkDateFormats()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
