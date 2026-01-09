const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP'
});

async function checkTables() {
  await client.connect();
  
  const result = await client.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND (tablename LIKE '%bog%' OR tablename LIKE '%raw%')
    ORDER BY tablename
  `);
  
  console.log('Tables:', result.rows.map(r => r.tablename).join(', '));
  
  // Check bog_gel_raw_893486000 columns
  if (result.rows.some(r => r.tablename === 'bog_gel_raw_893486000')) {
    const cols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'bog_gel_raw_893486000'
        AND table_schema = 'public'
      ORDER BY ordinal_position
      LIMIT 20
    `);
    console.log('\nColumns in bog_gel_raw_893486000:', cols.rows.map(r => r.column_name).join(', '));
  }
  
  await client.end();
}

checkTables().catch(console.error);
