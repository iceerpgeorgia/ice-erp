const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkSchema() {
  const client = await localPool.connect();
  
  try {
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'consolidated_bank_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in LOCAL consolidated_bank_accounts:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}`);
    });
    
  } finally {
    client.release();
    await localPool.end();
  }
}

checkSchema();
