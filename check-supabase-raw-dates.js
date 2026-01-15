const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMaxDate() {
  const client = await remotePool.connect();
  
  try {
    console.log('🔍 Checking maximum date in Supabase raw tables...\n');
    
    // Find all bog_gel_raw tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'bog_gel_raw_%'
      ORDER BY table_name
    `);
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      // Get count
      const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
      
      // Get max date
      const maxDate = await client.query(`
        SELECT MAX(docvaluedate) as max_date 
        FROM ${tableName}
      `);
      
      // Get min date
      const minDate = await client.query(`
        SELECT MIN(docvaluedate) as min_date 
        FROM ${tableName}
      `);
      
      console.log(`📋 ${tableName}:`);
      console.log(`   Total records: ${count.rows[0].count}`);
      console.log(`   Min date: ${minDate.rows[0].min_date}`);
      console.log(`   Max date: ${maxDate.rows[0].max_date}`);
      console.log();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await remotePool.end();
  }
}

checkMaxDate()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
