const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres:fulebimojviT1985%@localhost:5432/ICE_ERP',
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('prisma/migrations/create_consolidated_bank_accounts.sql', 'utf8');
    await client.query(sql);
    console.log('✅ Migration applied to LOCAL database successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
