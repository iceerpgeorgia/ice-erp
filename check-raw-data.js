const { Pool } = require('pg');

const supabasePool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const localPool = new Pool({
  connectionString: 'postgresql://postgres:fulebimojviT1985%@localhost:5432/ICE_ERP',
});

async function copyRawTable() {
  const supabaseClient = await supabasePool.connect();
  const localClient = await localPool.connect();
  
  try {
    console.log('Checking if raw table exists locally...');
    const tableCheck = await localClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bog_gel_raw_893486000'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating raw table locally...');
      const createTableSql = await supabaseClient.query(`
        SELECT 'CREATE TABLE bog_gel_raw_893486000 (' ||
        string_agg(column_name || ' ' || data_type || 
          CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')' 
            ELSE '' 
          END, ', ') || ');'
        FROM information_schema.columns
        WHERE table_name = 'bog_gel_raw_893486000'
        GROUP BY table_name
      `);
      
      // Simpler approach: get the schema
      const schema = await supabaseClient.query(`
        SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'bog_gel_raw_893486000'
        ORDER BY ordinal_position
      `);
      
      console.log(`Found ${schema.rows.length} columns in source table`);
    }
    
    console.log('Fetching raw records from Supabase...');
    const result = await supabaseClient.query(`
      SELECT * FROM bog_gel_raw_893486000 ORDER BY id LIMIT 100
    `);
    
    console.log(`Sample data for record d71dd00d-40f3-4899-bb9b-5d14c4028a2b:`);
    const targetRecord = result.rows.find(r => r.uuid === 'd71dd00d-40f3-4899-bb9b-5d14c4028a2b');
    if (targetRecord) {
      console.log(JSON.stringify(targetRecord, null, 2));
    } else {
      console.log('Record not found in first 100 rows, fetching directly...');
      const directFetch = await supabaseClient.query(`
        SELECT * FROM bog_gel_raw_893486000 WHERE uuid = $1
      `, ['d71dd00d-40f3-4899-bb9b-5d14c4028a2b']);
      
      if (directFetch.rows.length > 0) {
        console.log(JSON.stringify(directFetch.rows[0], null, 2));
      } else {
        console.log('Record not found on Supabase either!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    supabaseClient.release();
    localClient.release();
    await supabasePool.end();
    await localPool.end();
  }
}

copyRawTable();
