const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkPaymentsReport() {
  const client = await pool.connect();
  
  try {
    console.log('Checking payments report data...\n');
    
    // Check total payments
    const totalPayments = await client.query(`
      SELECT COUNT(*) FROM payments WHERE is_active = true
    `);
    console.log(`Total active payments: ${totalPayments.rows[0].count}`);
    
    // Check payments with ledger entries
    const paymentsWithLedger = await client.query(`
      SELECT COUNT(DISTINCT p.payment_id) 
      FROM payments p
      INNER JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      WHERE p.is_active = true
    `);
    console.log(`Payments with ledger entries: ${paymentsWithLedger.rows[0].count}`);
    
    // Check payments with bank transactions
    const paymentsWithBank = await client.query(`
      SELECT COUNT(DISTINCT p.payment_id) 
      FROM payments p
      INNER JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      WHERE p.is_active = true
    `);
    console.log(`Payments with bank transactions: ${paymentsWithBank.rows[0].count}`);
    
    // Check payments with ONLY bank transactions (no ledger)
    const paymentsOnlyBank = await client.query(`
      SELECT COUNT(DISTINCT p.payment_id) 
      FROM payments p
      INNER JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      WHERE p.is_active = true AND pl.payment_id IS NULL
    `);
    console.log(`Payments with ONLY bank transactions (no ledger): ${paymentsOnlyBank.rows[0].count}`);
    
    // Check current report query results
    const currentReport = await client.query(`
      SELECT COUNT(*)
      FROM (
        SELECT 
          p.payment_id
        FROM payments p
        LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
        LEFT JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
        WHERE p.is_active = true
        GROUP BY p.payment_id
      ) subq
    `);
    console.log(`Current report query returns: ${currentReport.rows[0].count} rows`);
    
    // Show some examples of payments with ONLY bank transactions
    console.log('\nExample payments with ONLY bank transactions (no ledger):');
    const examples = await client.query(`
      SELECT 
        p.payment_id,
        COUNT(cba.id) as bank_count,
        SUM(cba.nominal_amount) as total_amount,
        MAX(cba.transaction_date) as latest_date
      FROM payments p
      INNER JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      WHERE p.is_active = true AND pl.payment_id IS NULL
      GROUP BY p.payment_id
      ORDER BY MAX(cba.transaction_date) DESC
      LIMIT 5
    `);
    
    examples.rows.forEach(row => {
      console.log(`  ${row.payment_id}: ${row.bank_count} transactions, total ${row.total_amount}, latest ${row.latest_date}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkPaymentsReport().catch(console.error);
