const { Client } = require('pg');

async function insertBrands(dbUrl, dbName) {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log(`\n=== Inserting brands in ${dbName} ===`);
    
    // Insert FU ZHOU
    const fuzhou = await client.query(`
      INSERT INTO brands (uuid, name, counteragent_uuids, is_active)
      VALUES (gen_random_uuid(), 'FU ZHOU', '{}', true)
      RETURNING uuid, name
    `);
    console.log(`✓ Inserted: ${fuzhou.rows[0].name} (${fuzhou.rows[0].uuid})`);
    
    // Insert LG
    const lg = await client.query(`
      INSERT INTO brands (uuid, name, counteragent_uuids, is_active)
      VALUES (gen_random_uuid(), 'LG', '{}', true)
      RETURNING uuid, name
    `);
    console.log(`✓ Inserted: ${lg.rows[0].name} (${lg.rows[0].uuid})`);
    
    // Check total count
    const count = await client.query('SELECT COUNT(*) FROM brands WHERE is_active = true');
    console.log(`Total active brands: ${count.rows[0].count}`);
    
  } catch (error) {
    console.error(`Error inserting brands in ${dbName}:`, error.message);
  } finally {
    await client.end();
  }
}

// Run for both databases
(async () => {
  const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
  const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  
  await insertBrands(LOCAL, 'LOCAL');
  await insertBrands(SUPABASE, 'SUPABASE');
  
  console.log('\n=== Done ===');
})();
