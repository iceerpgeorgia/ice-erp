const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function syncRawDataFromSupabase() {
  const supabase = new Client({
    connectionString: process.env.REMOTE_DATABASE_URL
  });

  const local = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await supabase.connect();
    await local.connect();
    console.log('✅ Connected to both databases\n');

    // Step 1: Get all raw records from Supabase
    console.log('📥 Fetching raw records from Supabase...');
    const rawRecords = await supabase.query(`
      SELECT * FROM bog_gel_raw_893486000
      ORDER BY id
    `);
    
    console.log(`✅ Found ${rawRecords.rows.length} raw records\n`);

    // Step 2: Truncate local raw table
    console.log('🗑️  Truncating local raw table...');
    await local.query('TRUNCATE TABLE bog_gel_raw_893486000');
    console.log('✅ Local raw table truncated\n');

    // Step 3: Get column names
    const columns = Object.keys(rawRecords.rows[0]).filter(col => col !== 'id'); // Exclude id as it's auto-generated
    const columnList = columns.join(', ');
    
    console.log(`📋 Columns to copy: ${columns.length}`);
    console.log(`🔄 Inserting ${rawRecords.rows.length} records in batches...\n`);

    // Step 4: Insert in batches
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < rawRecords.rows.length; i += BATCH_SIZE) {
      const batch = rawRecords.rows.slice(i, i + BATCH_SIZE);
      
      // Build VALUES clause
      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const row of batch) {
        const rowValues = columns.map(col => {
          params.push(row[col]);
          return `$${paramIndex++}`;
        });
        values.push(`(${rowValues.join(', ')})`);
      }

      const insertQuery = `
        INSERT INTO bog_gel_raw_893486000 (${columnList})
        VALUES ${values.join(', ')}
      `;

      await local.query(insertQuery, params);
      insertedCount += batch.length;
      console.log(`  ✅ Inserted ${insertedCount}/${rawRecords.rows.length} records...`);
    }

    console.log('\n✅ Raw data sync completed!');

    // Step 5: Verify
    const localCount = await local.query('SELECT COUNT(*) FROM bog_gel_raw_893486000');
    console.log(`\n📊 Local raw table now has: ${localCount.rows[0].count} records`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await supabase.end();
    await local.end();
  }
}

syncRawDataFromSupabase()
  .then(() => {
    console.log('\n✅ Sync completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  });
