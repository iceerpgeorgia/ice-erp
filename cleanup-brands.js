const { Client } = require('pg');

(async () => {
  const local = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  const remote = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres'
  });

  await local.connect();
  await remote.connect();

  console.log('🧹 Cleaning up counteragent_uuids...\n');

  // Set empty arrays where null or empty
  await local.query(`
    UPDATE brands 
    SET counteragent_uuids = '{}' 
    WHERE counteragent_uuids IS NULL OR array_length(counteragent_uuids, 1) IS NULL
  `);
  
  await remote.query(`
    UPDATE brands 
    SET counteragent_uuids = '{}' 
    WHERE counteragent_uuids IS NULL OR array_length(counteragent_uuids, 1) IS NULL
  `);

  console.log('✅ Cleared null/empty counteragent_uuids in both databases\n');

  // Show current state
  const result = await remote.query(`
    SELECT uuid, name, counteragent_uuids 
    FROM brands 
    ORDER BY name
  `);

  console.log('📋 Brands with counteragent_uuids:\n');
  result.rows.forEach(b => {
    const uuids = b.counteragent_uuids && b.counteragent_uuids.length > 0 
      ? b.counteragent_uuids.join(', ')
      : '(empty)';
    console.log(`${b.name.padEnd(35)} - ${uuids}`);
  });

  await local.end();
  await remote.end();
})();
