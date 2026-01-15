const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    // Check payments count
    const paymentsCount = await prisma.payment.count({ where: { isActive: true } });
    console.log('Active payments:', paymentsCount);

    // Check sample payments with all data
    const samplePayments = await prisma.$queryRaw`
      SELECT 
        p.payment_id,
        p.project_uuid,
        p.counteragent_uuid,
        COALESCE(SUM(pl.accrual), 0) as total_accrual,
        COALESCE(SUM(pl."order"), 0) as total_order,
        COALESCE(SUM(cba.nominal_amount), 0) as total_payment,
        COUNT(DISTINCT cba.uuid) as bank_tx_count,
        COUNT(DISTINCT pl.id) as ledger_count,
        MAX(pl.effective_date) as latest_ledger_date,
        MAX(cba.transaction_date::date) as latest_bank_date
      FROM payments p
      LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id
      LEFT JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      WHERE p.is_active = true
      GROUP BY p.payment_id, p.project_uuid, p.counteragent_uuid
      ORDER BY p.payment_id
      LIMIT 10
    `;

    console.log('\nSample payments data:');
    samplePayments.forEach(p => {
      console.log(`\nPayment: ${p.payment_id}`);
      console.log(`  Accrual: ${p.total_accrual}, Order: ${p.total_order}, Payment: ${p.total_payment}`);
      console.log(`  Bank TXs: ${p.bank_tx_count}, Ledger entries: ${p.ledger_count}`);
      console.log(`  Latest dates: Ledger=${p.latest_ledger_date}, Bank=${p.latest_bank_date}`);
    });

    // Check consolidated_bank_accounts with payment_id
    const bankTxWithPaymentId = await prisma.$queryRaw`
      SELECT payment_id, COUNT(*) as count
      FROM consolidated_bank_accounts
      WHERE payment_id IS NOT NULL
      GROUP BY payment_id
      ORDER BY count DESC
      LIMIT 5
    `;

    console.log('\nTop bank transactions by payment_id:');
    bankTxWithPaymentId.forEach(tx => {
      console.log(`  ${tx.payment_id}: ${tx.count} transactions`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
