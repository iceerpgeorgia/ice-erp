const { Client } = require('pg');

// Database connections
const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';

async function syncBrands() {
  const localClient = new Client({ connectionString: LOCAL });
  const supabaseClient = new Client({ connectionString: SUPABASE });
  
  try {
    await localClient.connect();
    await supabaseClient.connect();
    
    // Get all brands from SUPABASE
    console.log('=== Fetching brands from SUPABASE ===');
    const supabaseResult = await supabaseClient.query(`
      SELECT uuid, name, is_active, created_at, updated_at
      FROM brands
      ORDER BY name
    `);
    
    console.log(`Found ${supabaseResult.rows.length} brands in SUPABASE`);
    
    // Truncate LOCAL brands table
    console.log('\n=== Truncating LOCAL brands table ===');
    await localClient.query('TRUNCATE TABLE brands CASCADE');
    console.log('Truncated brands table in LOCAL');
    
    // Insert brands from SUPABASE into LOCAL
    console.log('\n=== Inserting brands into LOCAL ===');
    let inserted = 0;
    
    for (const brand of supabaseResult.rows) {
      await localClient.query(`
        INSERT INTO brands (uuid, name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [brand.uuid, brand.name, brand.is_active, brand.created_at, brand.updated_at]);
      
      inserted++;
      if (inserted % 10 === 0) {
        console.log(`Inserted ${inserted} brands...`);
      }
    }
    
    console.log(`\nCompleted: Inserted ${inserted} brands into LOCAL`);
    
    // Verify
    const localCount = await localClient.query('SELECT COUNT(*) FROM brands');
    console.log(`\nVerification: LOCAL now has ${localCount.rows[0].count} brands`);
    
  } catch (error) {
    console.error('Error syncing brands:', error);
    throw error;
  } finally {
    await localClient.end();
    await supabaseClient.end();
  }
}

syncBrands();
