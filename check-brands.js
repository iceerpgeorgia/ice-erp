const { Client } = require('pg');

const LOCAL = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP';
const SUPABASE = 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';

async function checkBrands() {
  const localClient = new Client({ connectionString: LOCAL });
  const supabaseClient = new Client({ connectionString: SUPABASE });

  try {
    await localClient.connect();
    await supabaseClient.connect();
    
    console.log('=== LOCAL Brands ===');
    const localResult = await localClient.query(`
      SELECT uuid, name, is_active
      FROM brands
      ORDER BY name
    `);
    console.log(`Total: ${localResult.rows.length}`);
    localResult.rows.forEach(b => {
      console.log(`${b.name} - ${b.uuid}`);
    });

    console.log('\n=== SUPABASE Brands ===');
    const supabaseResult = await supabaseClient.query(`
      SELECT uuid, name, is_active
      FROM brands
      ORDER BY name
    `);
    console.log(`Total: ${supabaseResult.rows.length}`);
    supabaseResult.rows.forEach(b => {
      console.log(`${b.name} - ${b.uuid}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await localClient.end();
    await supabaseClient.end();
  }
}

checkBrands();
