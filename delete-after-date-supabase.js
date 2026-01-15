const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deleteAfterDate() {
  const client = await remotePool.connect();
  
  try {
    console.log('🗑️  Deleting records from Supabase after 19.11.2025...\n');
    
    // Count records before
    const beforeCount = await client.query(`
      SELECT COUNT(*) FROM bog_gel_raw_893486000
    `);
    console.log(`Before: ${beforeCount.rows[0].count} total records`);
    
    // Count records to delete (date format is DD.MM.YYYY as text)
    const toDeleteCount = await client.query(`
      SELECT COUNT(*) FROM bog_gel_raw_893486000
      WHERE docvaluedate > '19.11.2025'
    `);
    console.log(`To delete: ${toDeleteCount.rows[0].count} records (after 19.11.2025)\n`);
    
    if (parseInt(toDeleteCount.rows[0].count) === 0) {
      console.log('✅ No records to delete!');
      return;
    }
    
    // Show sample of what will be deleted
    const samples = await client.query(`
      SELECT docvaluedate, COUNT(*) as count
      FROM bog_gel_raw_893486000
      WHERE docvaluedate > '19.11.2025'
      GROUP BY docvaluedate
      ORDER BY docvaluedate
      LIMIT 10
    `);
    
    console.log('Sample dates to delete:');
    samples.rows.forEach(row => {
      console.log(`  ${row.docvaluedate}: ${row.count} records`);
    });
    console.log();
    
    // Delete
    console.log('Deleting...');
    const result = await client.query(`
      DELETE FROM bog_gel_raw_893486000
      WHERE docvaluedate > '19.11.2025'
    `);
    
    console.log(`✅ Deleted ${result.rowCount} records\n`);
    
    // Verify
    const afterCount = await client.query(`
      SELECT COUNT(*) FROM bog_gel_raw_893486000
    `);
    console.log(`After: ${afterCount.rows[0].count} total records`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await remotePool.end();
  }
}

deleteAfterDate()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
