const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncRawData() {
  const localClient = await localPool.connect();
  const remoteClient = await remotePool.connect();
  
  try {
    console.log('🔄 Syncing raw data from LOCAL → SUPABASE\n');
    console.log('=' .repeat(80));
    
    // Get all UUIDs from local
    console.log('\n📥 Fetching all UUIDs from local...');
    const localUuids = await localClient.query(`
      SELECT uuid FROM bog_gel_raw_893486000
    `);
    const localSet = new Set(localUuids.rows.map(r => r.uuid));
    console.log(`   Found ${localSet.size} records in local`);
    
    // Get all UUIDs from Supabase
    console.log('📥 Fetching all UUIDs from Supabase...');
    const remoteUuids = await remoteClient.query(`
      SELECT uuid FROM bog_gel_raw_893486000
    `);
    const remoteSet = new Set(remoteUuids.rows.map(r => r.uuid));
    console.log(`   Found ${remoteSet.size} records in Supabase\n`);
    
    // Find missing UUIDs
    const missing = [...localSet].filter(uuid => !remoteSet.has(uuid));
    console.log(`📊 Missing in Supabase: ${missing.length} records\n`);
    
    if (missing.length === 0) {
      console.log('✅ No records to sync!');
      return;
    }
    
    // Fetch missing records from local
    console.log('📥 Fetching missing records from local...');
    const missingRecords = await localClient.query(`
      SELECT * FROM bog_gel_raw_893486000
      WHERE uuid = ANY($1::uuid[])
      ORDER BY docvaluedate
    `, [missing]);
    
    console.log(`   Retrieved ${missingRecords.rows.length} records\n`);
    
    // Get column names (exclude generated columns)
    const allColumns = Object.keys(missingRecords.rows[0]);
    const columns = allColumns.filter(col => col !== 'processing_case');
    const columnList = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    // Insert into Supabase
    console.log('💾 Inserting into Supabase...');
    let inserted = 0;
    
    for (const record of missingRecords.rows) {
      const values = columns.map(col => record[col]);
      
      await remoteClient.query(`
        INSERT INTO bog_gel_raw_893486000 (${columnList})
        VALUES (${placeholders})
        ON CONFLICT (uuid) DO NOTHING
      `, values);
      
      inserted++;
      if (inserted % 100 === 0) {
        process.stdout.write(`\r   Progress: ${inserted}/${missingRecords.rows.length} (${Math.round(inserted/missingRecords.rows.length*100)}%)`);
      }
    }
    
    console.log(`\r   ✅ Inserted ${inserted} records\n`);
    
    // Verify
    const finalCount = await remoteClient.query(`SELECT COUNT(*) FROM bog_gel_raw_893486000`);
    console.log(`📊 Final Supabase count: ${finalCount.rows[0].count}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Sync complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    localClient.release();
    remoteClient.release();
    await localPool.end();
    await remotePool.end();
  }
}

syncRawData()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
