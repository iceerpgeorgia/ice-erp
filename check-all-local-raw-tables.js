const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkAllRawTables() {
  const client = await localPool.connect();
  
  try {
    console.log('🔍 Checking ALL raw tables in LOCAL database...\n');
    
    // Find ALL tables that might contain raw data
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (
          table_name LIKE 'bog_gel_raw_%'
          OR table_name LIKE '%raw%'
          OR table_name LIKE 'bog_%'
        )
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} potential raw tables:\n`);
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      try {
        // Check if table has docvaluedate column
        const columns = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
            AND column_name IN ('docvaluedate', 'transaction_date', 'date', 'doc_value_date')
        `);
        
        if (columns.rows.length === 0) {
          console.log(`⚠️  ${tableName}: No date column found`);
          continue;
        }
        
        const dateColumn = columns.rows[0].column_name;
        
        // Get count
        const count = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        
        if (parseInt(count.rows[0].count) === 0) {
          console.log(`📋 ${tableName}: Empty`);
          continue;
        }
        
        // Get date range
        const dateRange = await client.query(`
          SELECT 
            MIN(${dateColumn}) as min_date,
            MAX(${dateColumn}) as max_date
          FROM ${tableName}
        `);
        
        console.log(`📋 ${tableName}:`);
        console.log(`   Records: ${count.rows[0].count}`);
        console.log(`   Date column: ${dateColumn}`);
        console.log(`   Min: ${dateRange.rows[0].min_date}`);
        console.log(`   Max: ${dateRange.rows[0].max_date}`);
        console.log();
        
      } catch (err) {
        console.log(`❌ ${tableName}: Error - ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await localPool.end();
  }
}

checkAllRawTables()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
