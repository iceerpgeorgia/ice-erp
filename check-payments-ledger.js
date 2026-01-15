const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPaymentsLedger() {
  try {
    // Count total records
    const count = await prisma.paymentLedger.count();
    console.log('Total Payments Ledger records:', count);

    // Get sample records
    const samples = await prisma.paymentLedger.findMany({
      take: 5,
      include: {
        payment: {
          select: {
            paymentId: true,
            counteragentUuid: true,
            projectUuid: true
          }
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    });

    console.log('\nSample records:');
    samples.forEach((record, idx) => {
      console.log(`\n${idx + 1}. Record UUID: ${record.recordUuid}`);
      console.log(`   Payment ID: ${record.payment?.paymentId || 'N/A'}`);
      console.log(`   Accrual: ${record.accrual}`);
      console.log(`   Order: ${record.order}`);
      console.log(`   Effective Date: ${record.effectiveDate}`);
      console.log(`   Counteragent UUID: ${record.payment?.counteragentUuid || 'N/A'}`);
      console.log(`   Project UUID: ${record.payment?.projectUuid || 'N/A'}`);
    });

    // Check aggregates by payment_uuid
    const aggregates = await prisma.$queryRaw`
      SELECT 
        payment_uuid,
        COUNT(*) as entry_count,
        SUM(accrual) as total_accrual,
        SUM("order") as total_order,
        SUM(payment_amount) as total_payment
      FROM payments_ledger
      GROUP BY payment_uuid
      LIMIT 5
    `;

    console.log('\nAggregates by payment:');
    console.log(aggregates);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPaymentsLedger();
