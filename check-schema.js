const { Client } = require('pg');

async function checkSchemas() {
  console.log('\n=== LOCAL DATABASE ===');
  const localClient = new Client({
    connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
  });
  
  try {
    await localClient.connect();
    const localResult = await localClient.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'parsing_scheme_rules'
      ORDER BY ordinal_position
    `);
    
    console.log('\nLocal columns:');
    localResult.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} nullable: ${row.is_nullable} default: ${row.column_default || 'none'}`);
    });
    
  } catch (error) {
    console.error('Local error:', error.message);
  } finally {
    await localClient.end();
  }

  console.log('\n\n=== SUPABASE DATABASE ===');
  const supabaseClient = new Client({
    connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
  });
  
  try {
    await supabaseClient.connect();
    const supabaseResult = await supabaseClient.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'parsing_scheme_rules'
      ORDER BY ordinal_position
    `);
    
    console.log('\nSupabase columns:');
    supabaseResult.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} nullable: ${row.is_nullable} default: ${row.column_default || 'none'}`);
    });
    
  } catch (error) {
    console.error('Supabase error:', error.message);
  } finally {
    await supabaseClient.end();
  }
}

checkSchemas();
