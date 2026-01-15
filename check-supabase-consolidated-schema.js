const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const remotePool = new Pool({
  connectionString: process.env.REMOTE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  const client = await remotePool.connect();
  
  try {
    console.log('🔍 Checking consolidated_bank_accounts schema in Supabase...\n');
    
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consolidated_bank_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in Supabase:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
  } finally {
    client.release();
    await remotePool.end();
  }
}

checkSchema();
