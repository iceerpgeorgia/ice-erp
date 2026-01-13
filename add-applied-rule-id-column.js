const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addColumn() {
  try {
    await pool.query('ALTER TABLE consolidated_bank_accounts ADD COLUMN IF NOT EXISTS applied_rule_id INTEGER');
    console.log('✅ Column applied_rule_id added to consolidated_bank_accounts');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

addColumn();
