const { Client } = require('pg');
const fs = require('fs');

(async () => {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  const remote = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });

  await local.connect();
  await remote.connect();

  const sql = fs.readFileSync('create-jobs-table.sql', 'utf8');

  console.log('📋 Creating jobs table...\n');

  try {
    // Create in LOCAL
    await local.query(sql);
    console.log('✅ LOCAL: jobs table created');

    // Create in SUPABASE
    await remote.query(sql);
    console.log('✅ SUPABASE: jobs table created');

    // Verify
    const localCheck = await local.query("SELECT COUNT(*) FROM jobs");
    const remoteCheck = await remote.query("SELECT COUNT(*) FROM jobs");

    console.log('\n📊 Verification:');
    console.log(`  LOCAL: ${localCheck.rows[0].count} jobs`);
    console.log(`  SUPABASE: ${remoteCheck.rows[0].count} jobs`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  await local.end();
  await remote.end();
})();
