const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
});

async function cleanupNullRecords() {
  await client.connect();
  
  console.log('🧹 Cleaning up records with null DocKey or EntriesId...\n');
  
  const result = await client.query(`
    DELETE FROM bog_gel_raw_893486000
    WHERE DocKey IS NULL OR EntriesId IS NULL
    RETURNING uuid, DocKey, EntriesId
  `);
  
  console.log(`✅ Deleted ${result.rowCount} records with null keys`);
  
  if (result.rows.length > 0) {
    console.log('\nDeleted records:');
    result.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. UUID: ${row.uuid}, DocKey: ${row.dockey}, EntriesId: ${row.entriesid}`);
    });
  }
  
  await client.end();
}

cleanupNullRecords().catch(console.error);
