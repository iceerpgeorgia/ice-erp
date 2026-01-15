const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkSpecificPayment() {
  const client = await pool.connect();
  
  try {
    console.log('Checking specific payment with only bank transactions...\n');
    
    // Check one of the payments with only bank transactions
    const paymentId = '18ae58_93_a778';
    
    const result = await client.query(`
      SELECT 
        p.payment_id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        proj.project_index,
        proj.project_name,
        ca.counteragent as counteragent_formatted,
        ca.name as counteragent_name,
        ca.identification_number as counteragent_id,
        fc.validation as financial_code_validation,
        fc.code as financial_code,
        j.job_name,
        j.floors,
        curr.code as currency_code,
        COALESCE(SUM(pl.accrual), 0) as total_accrual,
        COALESCE(SUM(pl."order"), 0) as total_order,
        COALESCE(SUM(cba.nominal_amount), 0) as total_payment,
        GREATEST(MAX(pl.effective_date), MAX(cba.transaction_date::date)) as latest_date,
        COUNT(pl.id) as ledger_count,
        COUNT(cba.id) as bank_count
      FROM payments p
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      LEFT JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      WHERE p.is_active = true AND p.payment_id = $1
      GROUP BY 
        p.payment_id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        proj.project_index,
        proj.project_name,
        ca.counteragent,
        ca.name,
        ca.identification_number,
        fc.validation,
        fc.code,
        j.job_name,
        j.floors,
        curr.code
    `, [paymentId]);
    
    console.log('Payment details:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    // Calculate display values
    const row = result.rows[0];
    console.log('\nDisplay values:');
    console.log(`Accrual: ${row.total_accrual}`);
    console.log(`Order: ${row.total_order}`);
    console.log(`Payment: ${row.total_payment}`);
    console.log(`Ledger entries: ${row.ledger_count}`);
    console.log(`Bank transactions: ${row.bank_count}`);
    console.log(`Paid %: ${row.total_accrual != 0 ? ((parseFloat(row.total_payment) / parseFloat(row.total_accrual)) * 100).toFixed(2) : 0}%`);
    console.log(`Due: ${(parseFloat(row.total_order) - parseFloat(row.total_payment)).toFixed(2)}`);
    console.log(`Balance: ${(parseFloat(row.total_accrual) - parseFloat(row.total_payment)).toFixed(2)}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkSpecificPayment().catch(console.error);
