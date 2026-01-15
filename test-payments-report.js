const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPaymentsReport() {
  try {
    console.log('Testing payments report query with payment_id...\n');

    // Test the updated query
    const query = `
      SELECT 
        p.payment_id,
        p.counteragent_uuid,
        p.project_uuid,
        COALESCE(SUM(pl.accrual), 0) as total_accrual,
        COALESCE(SUM(pl."order"), 0) as total_order,
        COALESCE(SUM(cba.nominal_amount), 0) as total_payment,
        COUNT(cba.uuid) as bank_transaction_count,
        GREATEST(MAX(pl.effective_date), MAX(cba.transaction_date::date)) as latest_date
      FROM payments p
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      LEFT JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      WHERE p.is_active = true
      GROUP BY p.payment_id, p.counteragent_uuid, p.project_uuid
      HAVING COALESCE(SUM(cba.nominal_amount), 0) > 0
      ORDER BY total_payment DESC
      LIMIT 10
    `;

    const results = await prisma.$queryRawUnsafe(query);

    console.log('✅ Query successful!\n');
    console.log(`Found ${results.length} payments with actual bank transactions:\n`);

    results.forEach((row, idx) => {
      console.log(`${idx + 1}. Payment ID: ${row.payment_id}`);
      console.log(`   Accrual: ${row.total_accrual}`);
      console.log(`   Order: ${row.total_order}`);
      console.log(`   Payment (from bank): ${row.total_payment}`);
      console.log(`   Bank transactions: ${row.bank_transaction_count}`);
      console.log(`   Latest date: ${row.latest_date}`);
      console.log('');
    });

    if (results.length === 0) {
      console.log('⚠️  No payments with bank transactions found yet.');
      console.log('   This is expected if payment_id has not been populated in consolidated_bank_accounts.');
      console.log('   Next XML import will populate payment_id automatically.\n');
    }

    // Check consolidated_bank_accounts for payment_id
    const cbaCheck = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(payment_id) as with_payment_id
      FROM consolidated_bank_accounts
    `;

    console.log('Consolidated Bank Accounts Status:');
    console.log(`   Total records: ${cbaCheck[0].total}`);
    console.log(`   With payment_id: ${cbaCheck[0].with_payment_id}`);
    console.log(`   Percentage: ${(Number(cbaCheck[0].with_payment_id) / Number(cbaCheck[0].total) * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentsReport();
