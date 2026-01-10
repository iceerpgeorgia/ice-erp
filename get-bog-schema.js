const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
});

async function getSchema() {
  await client.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'bog_gel_raw_893486000' 
    ORDER BY ordinal_position
  `);
  
  console.log(JSON.stringify(result.rows, null, 2));
  
  await client.end();
}

getSchema();
