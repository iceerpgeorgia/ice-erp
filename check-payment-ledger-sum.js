const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkPaymentLedger() {
  const pool = new Pool({
    connectionString: process.env.REMOTE_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const paymentId = 'c11c73_37_ae9101';
    
    console.log(`\n=== Payment Summary for ${paymentId} ===\n`);
    
    // Check number of bank transactions
    const bankCountResult = await pool.query(
      'SELECT COUNT(*) as bank_count FROM consolidated_bank_accounts WHERE payment_id = $1',
      [paymentId]
    );
    console.log('Number of bank transactions:', bankCountResult.rows[0].bank_count);
    console.log('');
    
    // Get sum of bank payments
    const bankSumResult = await pool.query(
      'SELECT SUM(nominal_amount) as total_payments FROM consolidated_bank_accounts WHERE payment_id = $1',
      [paymentId]
    );
    console.log('Total Bank Payments:', bankSumResult.rows[0].total_payments || '0.00');
    console.log('');
    
    // Get sum of accruals and orders
    const sumResult = await pool.query(
      `SELECT 
        payment_id,
        SUM(accrual) as total_accrual,
        SUM("order") as total_order,
        COUNT(*) as entry_count
      FROM payments_ledger 
      WHERE payment_id = $1 
      GROUP BY payment_id`,
      [paymentId]
    );
    
    if (sumResult.rows.length > 0) {
      const row = sumResult.rows[0];
      console.log('Total Accrual:', row.total_accrual);
      console.log('Total Order:', row.total_order);
      console.log('Number of entries:', row.entry_count);
      
      // Get individual entries
      console.log('\n=== Individual Entries ===\n');
      const detailResult = await pool.query(
        `SELECT 
          id,
          effective_date,
          accrual,
          "order",
          comment,
          created_at
        FROM payments_ledger 
        WHERE payment_id = $1 
        ORDER BY effective_date DESC`,
        [paymentId]
      );
      
      detailResult.rows.forEach((entry, idx) => {
        console.log(`Entry ${idx + 1}:`);
        console.log('  ID:', entry.id);
        console.log('  Effective Date:', entry.effective_date);
        console.log('  Accrual:', entry.accrual);
        console.log('  Order:', entry.order);
        console.log('  Comment:', entry.comment || 'None');
        console.log('  Created:', entry.created_at);
        console.log('');
      });
    } else {
      console.log('No entries found for this payment ID');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPaymentLedger();
