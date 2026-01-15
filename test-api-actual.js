const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testActualAPIQuery() {
  try {
    // Exact query from the API route
    const query = `
      SELECT 
        p.payment_id,
        COALESCE(SUM(cba.nominal_amount), 0) as total_payment,
        COUNT(cba.uuid) as bank_tx_count
      FROM payments p
      LEFT JOIN consolidated_bank_accounts cba ON p.payment_id = cba.payment_id
      WHERE p.is_active = true
      GROUP BY p.payment_id
      HAVING COUNT(cba.uuid) > 0
      ORDER BY total_payment DESC
      LIMIT 10
    `;

    const results = await prisma.$queryRawUnsafe(query);

    console.log('Top 10 payments with actual bank transactions:\n');
    results.forEach((row, idx) => {
      console.log(`${idx + 1}. Payment: ${row.payment_id}`);
      console.log(`   Bank transactions: ${row.bank_tx_count}`);
      console.log(`   Total payment: ${row.total_payment}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testActualAPIQuery();
