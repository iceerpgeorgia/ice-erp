const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkDateFormats() {
  const client = await localPool.connect();
  
  try {
    console.log('🔍 Analyzing date formats in bog_gel_raw_893486000...\n');
    
    // Check sample dates
    const samples = await client.query(`
      SELECT docvaluedate, COUNT(*) as count
      FROM bog_gel_raw_893486000
      GROUP BY docvaluedate
      ORDER BY docvaluedate
      LIMIT 20
    `);
    
    console.log('First 20 dates:');
    samples.rows.forEach(row => {
      console.log(`  ${row.docvaluedate} (${row.count} records)`);
    });
    
    console.log('\n');
    
    // Check last dates
    const lastDates = await client.query(`
      SELECT docvaluedate, COUNT(*) as count
      FROM bog_gel_raw_893486000
      GROUP BY docvaluedate
      ORDER BY docvaluedate DESC
      LIMIT 20
    `);
    
    console.log('Last 20 dates:');
    lastDates.rows.forEach(row => {
      console.log(`  ${row.docvaluedate} (${row.count} records)`);
    });
    
    console.log('\n');
    
    // Check if there are any dates with year starting with 201
    const year2018 = await client.query(`
      SELECT COUNT(*) as count
      FROM bog_gel_raw_893486000
      WHERE docvaluedate LIKE '%.2018'
         OR docvaluedate LIKE '%.2019'
         OR docvaluedate LIKE '%.2020'
         OR docvaluedate LIKE '%.2021'
         OR docvaluedate LIKE '%.2022'
         OR docvaluedate LIKE '%.2023'
    `);
    
    console.log(`Records from 2018-2023: ${year2018.rows[0].count}`);
    
    // Total count
    const total = await client.query(`SELECT COUNT(*) FROM bog_gel_raw_893486000`);
    console.log(`Total records: ${total.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await localPool.end();
  }
}

checkDateFormats()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
