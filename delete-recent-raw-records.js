const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deleteRecentRecords() {
  const client = await remotePool.connect();
  
  try {
    console.log('🗑️  Deleting records from Supabase raw tables after 2025-11-19...\n');
    
    // Find all bog_gel_raw tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'bog_gel_raw_%'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} raw tables\n`);
    
    let totalDeleted = 0;
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      // Count records before
      const beforeCount = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
      
      // Count records to delete
      const toDeleteCount = await client.query(`
        SELECT COUNT(*) FROM ${tableName}
        WHERE docvaluedate > '19.11.2025'
      `);
      
      if (parseInt(toDeleteCount.rows[0].count) > 0) {
        console.log(`📋 ${tableName}:`);
        console.log(`   Before: ${beforeCount.rows[0].count} records`);
        console.log(`   To delete: ${toDeleteCount.rows[0].count} records (after 19.11.2025)`);
        
        // Delete
        const result = await client.query(`
          DELETE FROM ${tableName}
          WHERE docvaluedate > '19.11.2025'
        `);
        
        const afterCount = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        
        console.log(`   After: ${afterCount.rows[0].count} records`);
        console.log(`   ✅ Deleted ${result.rowCount} records\n`);
        
        totalDeleted += result.rowCount;
      } else {
        console.log(`✓ ${tableName}: No records to delete\n`);
      }
    }
    
    console.log('=' .repeat(80));
    console.log(`✅ Total deleted: ${totalDeleted} records across all tables`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await remotePool.end();
  }
}

deleteRecentRecords()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
