const { Pool } = require('pg');

async function addColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const result = await pool.query(`
      ALTER TABLE consolidated_bank_accounts 
      ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(20, 10),
      ADD COLUMN IF NOT EXISTS correction_date DATE;
      
      CREATE INDEX IF NOT EXISTS idx_consolidated_correction_date 
      ON consolidated_bank_accounts(correction_date);
    `);
    
    console.log('✓ Columns added successfully');
    console.log('  - exchange_rate DECIMAL(20, 10)');
    console.log('  - correction_date DATE');
    console.log('  - idx_consolidated_correction_date INDEX');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

addColumns();
