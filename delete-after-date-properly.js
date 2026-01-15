const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function parseDate(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.split('.');
  if (parts.length !== 3) return null;
  // Convert DD.MM.YYYY to YYYY-MM-DD for proper comparison
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

async function deleteAfterDate() {
  const client = await remotePool.connect();
  
  try {
    console.log('🗑️  Deleting records from Supabase after 19.11.2025...\n');
    
    const cutoffDate = '2025-11-19'; // YYYY-MM-DD format
    
    // Count records before
    const beforeCount = await client.query(`
      SELECT COUNT(*) FROM bog_gel_raw_893486000
    `);
    console.log(`Before: ${beforeCount.rows[0].count} total records`);
    
    // Get all records and filter in JavaScript
    console.log('Fetching all records to filter by date...');
    const allRecords = await client.query(`
      SELECT uuid, docvaluedate FROM bog_gel_raw_893486000
    `);
    
    const toDelete = [];
    for (const record of allRecords.rows) {
      const isoDate = parseDate(record.docvaluedate);
      if (isoDate && isoDate > cutoffDate) {
        toDelete.push(record.uuid);
      }
    }
    
    console.log(`To delete: ${toDelete.length} records (after 19.11.2025)\n`);
    
    if (toDelete.length === 0) {
      console.log('✅ No records to delete!');
      return;
    }
    
    // Show sample
    const sampleUuids = toDelete.slice(0, 10);
    const samples = await client.query(`
      SELECT docvaluedate, COUNT(*) as count
      FROM bog_gel_raw_893486000
      WHERE uuid = ANY($1::uuid[])
      GROUP BY docvaluedate
      ORDER BY docvaluedate
      LIMIT 10
    `, [sampleUuids]);
    
    console.log('Sample dates to delete:');
    samples.rows.forEach(row => {
      const iso = parseDate(row.docvaluedate);
      console.log(`  ${row.docvaluedate} (${iso}): ${row.count} records`);
    });
    console.log();
    
    // Delete in batches
    console.log('Deleting...');
    const batchSize = 1000;
    let deleted = 0;
    
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      await client.query(`
        DELETE FROM bog_gel_raw_893486000
        WHERE uuid = ANY($1::uuid[])
      `, [batch]);
      
      deleted += batch.length;
      process.stdout.write(`\r   Progress: ${deleted}/${toDelete.length} (${Math.round(deleted/toDelete.length*100)}%)`);
    }
    
    console.log(`\r✅ Deleted ${deleted} records\n`);
    
    // Verify
    const afterCount = await client.query(`
      SELECT COUNT(*) FROM bog_gel_raw_893486000
    `);
    console.log(`After: ${afterCount.rows[0].count} total records`);
    
    // Check max date
    const allAfter = await client.query(`
      SELECT docvaluedate FROM bog_gel_raw_893486000
    `);
    
    let maxDate = null;
    for (const record of allAfter.rows) {
      const iso = parseDate(record.docvaluedate);
      if (!maxDate || (iso && iso > maxDate)) {
        maxDate = iso;
      }
    }
    
    console.log(`Max date remaining: ${maxDate}`);
    
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
