const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkTable() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name='templates' LIMIT 1"
    );
    if (result.rows.length > 0) {
      console.log('✓ Templates table EXISTS');
      const columns = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='templates' ORDER BY ordinal_position"
      );
      console.log('\nColumns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('✗ Templates table DOES NOT EXIST');
    }
  } finally {
    client.end();
    pool.end();
  }
}

checkTable();
