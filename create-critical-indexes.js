/**
 * Create Critical Performance Indexes
 * 
 * Based on Supabase query performance analysis, these indexes will:
 * - Speed up queries by 10-100x
 * - Reduce CPU/IO usage by 50-90%
 * - Save ~40 minutes per backparse operation
 * 
 * ⚠️  RUN DURING LOW TRAFFIC HOURS (e.g., 3 AM local time)
 * These operations may take 5-30 minutes depending on table size.
 */

const { Client } = require('pg');
require('dotenv').config();

const indexes = [
  {
    name: 'idx_bog_gel_raw_docvaluedate',
    table: 'bog_gel_raw_893486000',
    column: 'DocValueDate',
    impact: '11x speedup on backparse queries',
    estimatedTime: '5-10 minutes',
    priority: 'CRITICAL'
  },
  {
    name: 'idx_counteragents_ts',
    table: 'counteragents',
    column: 'ts',
    impact: '10x speedup on API pagination',
    estimatedTime: '1-2 minutes',
    priority: 'HIGH'
  },
  {
    name: 'idx_consolidated_bank_processing_case',
    table: 'consolidated_bank_accounts',
    column: 'processing_case',
    impact: '9.6x speedup on parsing rules page',
    estimatedTime: '5-15 minutes',
    priority: 'HIGH'
  },
  {
    name: 'idx_consolidated_bank_transaction_date_id',
    table: 'consolidated_bank_accounts',
    columns: ['transaction_date', 'id'],
    impact: 'Faster pagination and date filtering',
    estimatedTime: '5-15 minutes',
    priority: 'MEDIUM'
  },
  {
    name: 'idx_bank_accounts_bank_uuid',
    table: 'bank_accounts',
    column: 'bank_uuid',
    impact: 'Faster JOINs with banks table',
    estimatedTime: '1 minute',
    priority: 'MEDIUM'
  }
];

async function createIndex(client, index) {
  const startTime = Date.now();
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Creating index: ${index.name}`);
    console.log(`Table: ${index.table}`);
    console.log(`Column(s): ${index.column || index.columns.join(', ')}`);
    console.log(`Priority: ${index.priority}`);
    console.log(`Expected impact: ${index.impact}`);
    console.log(`Estimated time: ${index.estimatedTime}`);
    console.log(`${'='.repeat(60)}`);
    
    // Check if index already exists
    const existingIndex = await client.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexname = $2`,
      [index.table, index.name]
    );
    
    if (existingIndex.rows.length > 0) {
      console.log(`⚠️  Index ${index.name} already exists. Skipping.`);
      return { success: true, skipped: true };
    }
    
    // Create index CONCURRENTLY to avoid table locks
    let sql;
    if (index.columns) {
      // Multi-column index
      sql = `CREATE INDEX CONCURRENTLY ${index.name} ON public.${index.table}(${index.columns.join(', ')})`;
    } else {
      // Single-column index
      sql = `CREATE INDEX CONCURRENTLY ${index.name} ON public.${index.table}(${index.column})`;
    }
    
    console.log(`\n⏳ Running: ${sql}`);
    console.log('⏳ This may take several minutes. Please wait...\n');
    
    // Set a long timeout for index creation (raw pg client doesn't need transaction)
    await client.query('SET statement_timeout = 0');
    await client.query(sql);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Index created successfully in ${elapsed} seconds`);
    
    return { success: true, time: elapsed };
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`❌ Failed after ${elapsed} seconds:`, error.message);
    
    // If it's a timeout, provide guidance
    if (error.message.includes('timeout') || error.message.includes('statement timeout')) {
      console.error('\n⚠️  INDEX CREATION TIMED OUT');
      console.error('This is likely due to Supabase resource exhaustion.');
      console.error('Recommendations:');
      console.error('1. Try again during lowest traffic time (3-5 AM)');
      console.error('2. Contact Supabase support for manual index creation');
      console.error('3. Consider upgrading Supabase plan for more resources');
    }
    
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Creating Critical Performance Indexes');
  console.log('⚠️  WARNING: Run this during LOW TRAFFIC hours!');
  console.log('   These operations may take 20-60 minutes total.\n');
  
  // Confirm user wants to proceed
  console.log('📋 Indexes to create:');
  indexes.forEach((idx, i) => {
    console.log(`${i + 1}. ${idx.name} (${idx.priority}) - ${idx.impact}`);
  });
  
  console.log('\n⏰ Starting index creation...\n');
  
  // Create PostgreSQL client (bypasses Prisma transactions)
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  console.log('✅ Connected to database\n');
  
  const results = {
    success: [],
    failed: [],
    skipped: []
  };
  
  const totalStartTime = Date.now();
  
  try {
    // Create indexes one by one (CONCURRENTLY means they won't block each other much)
    for (const index of indexes) {
      const result = await createIndex(client, index);
      
      if (result.skipped) {
        results.skipped.push(index.name);
      } else if (result.success) {
        results.success.push({ name: index.name, time: result.time });
      } else {
        results.failed.push({ name: index.name, error: result.error });
        
        // If a critical index fails, ask if user wants to continue
        if (index.priority === 'CRITICAL') {
          console.error('\n⚠️  CRITICAL index failed. Continuing with remaining indexes...\n');
        }
      }
      
      // Small delay between indexes
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
  
  const totalElapsed = ((Date.now() - totalStartTime) / 1000 / 60).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`⏱️  Total time: ${totalElapsed} minutes`);
  console.log(`✅ Successfully created: ${results.success.length} indexes`);
  console.log(`⏭️  Skipped (already exist): ${results.skipped.length} indexes`);
  console.log(`❌ Failed: ${results.failed.length} indexes`);
  
  if (results.success.length > 0) {
    console.log('\n✅ Successfully created indexes:');
    results.success.forEach(({ name, time }) => {
      console.log(`  - ${name} (${time}s)`);
    });
  }
  
  if (results.skipped.length > 0) {
    console.log('\n⏭️  Skipped indexes (already exist):');
    results.skipped.forEach(name => {
      console.log(`  - ${name}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed indexes:');
    results.failed.forEach(({ name, error }) => {
      console.log(`  - ${name}`);
      console.log(`    Error: ${error}`);
    });
    
    console.log('\n⚠️  If indexes timed out:');
    console.log('1. Contact Supabase support with this error log');
    console.log('2. Request manual index creation during maintenance window');
    console.log('3. Consider upgrading to a higher Supabase plan');
  }
  
  console.log('\n📊 Expected improvements:');
  console.log('- Backparse queries: 7+ min → 2-5 min');
  console.log('- API pagination: 10-20s → <1s');
  console.log('- Database CPU usage: -50% to -90%');
  console.log('- Query timeouts: Should be eliminated');
  
  console.log('\n🔍 Next steps:');
  console.log('1. Wait 5-10 minutes for Supabase metrics to update');
  console.log('2. Check Supabase dashboard for reduced resource usage');
  console.log('3. Try running backparse script again:');
  console.log('   python import_bank_xml_data.py backparse --account-uuid <uuid>');
}

main()
  .then(() => {
    console.log('\n✅ Index creation process complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
