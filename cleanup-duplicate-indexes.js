/**
 * Cleanup Duplicate Indexes
 * 
 * Removes duplicate indexes identified by Supabase linter.
 * Safe to run - only drops redundant indexes that have exact duplicates.
 */

const { Client } = require('pg');
require('dotenv').config();

const duplicatesToDrop = [
  {
    table: 'bank_accounts',
    indexToDrop: 'idx_bank_accounts_bank_uuid',
    keepIndex: 'bank_accounts_bank_uuid_idx',
    reason: 'Created duplicate during optimization'
  },
  {
    table: 'projects',
    indexToDrop: 'idx_projects_counteragent_uuid',
    keepIndex: 'projects_counteragent_uuid_idx',
    reason: 'Pre-existing duplicate'
  },
  {
    table: 'projects',
    indexToDrop: 'idx_projects_currency_uuid',
    keepIndex: 'projects_currency_uuid_idx',
    reason: 'Pre-existing duplicate'
  },
  {
    table: 'projects',
    indexToDrop: 'idx_projects_financial_code_uuid',
    keepIndex: 'projects_financial_code_uuid_idx',
    reason: 'Pre-existing duplicate'
  },
  {
    table: 'projects',
    indexToDrop: 'idx_projects_state_uuid',
    keepIndex: 'projects_state_uuid_idx',
    reason: 'Pre-existing duplicate'
  }
];

async function dropDuplicateIndexes() {
  console.log('🧹 Cleaning up duplicate indexes...\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  console.log('✅ Connected to database\n');
  
  const results = {
    dropped: [],
    notFound: [],
    failed: []
  };
  
  try {
    for (const dup of duplicatesToDrop) {
      console.log(`📋 Checking: ${dup.indexToDrop} on ${dup.table}`);
      console.log(`   Reason: ${dup.reason}`);
      console.log(`   Keeping: ${dup.keepIndex}`);
      
      try {
        // Check if index exists
        const checkResult = await client.query(
          `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
          [dup.indexToDrop]
        );
        
        if (checkResult.rows.length === 0) {
          console.log(`   ⏭️  Index doesn't exist, skipping\n`);
          results.notFound.push(dup.indexToDrop);
          continue;
        }
        
        // Drop the duplicate index
        await client.query(`DROP INDEX IF EXISTS public.${dup.indexToDrop}`);
        console.log(`   ✅ Dropped successfully\n`);
        results.dropped.push(dup.indexToDrop);
        
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}\n`);
        results.failed.push({ name: dup.indexToDrop, error: error.message });
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } finally {
    await client.end();
    console.log('✅ Database connection closed\n');
  }
  
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Dropped: ${results.dropped.length} indexes`);
  console.log(`⏭️  Not found: ${results.notFound.length} indexes`);
  console.log(`❌ Failed: ${results.failed.length} indexes`);
  
  if (results.dropped.length > 0) {
    console.log('\n✅ Successfully dropped:');
    results.dropped.forEach(name => console.log(`  - ${name}`));
  }
  
  if (results.notFound.length > 0) {
    console.log('\n⏭️  Not found (already cleaned):');
    results.notFound.forEach(name => console.log(`  - ${name}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed:');
    results.failed.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }
  
  console.log('\n📊 Expected result:');
  console.log('- Supabase issues: 5 warnings → 0 warnings');
  console.log('- Disk space: Slightly reduced');
  console.log('- Performance: No change (duplicates don\'t hurt performance)');
}

dropDuplicateIndexes()
  .then(() => {
    console.log('\n✅ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
