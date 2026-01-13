const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'consolidated_bank_accounts'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent columns in consolidated_bank_accounts:');
    console.log('==========================================');
    if (res.rows.length === 0) {
      console.log('❌ Table does not exist!');
    } else {
      res.rows.forEach(r => {
        console.log(`  ${r.column_name.padEnd(30)} ${r.data_type}`);
      });
    }
    console.log('==========================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns().catch(console.error);
