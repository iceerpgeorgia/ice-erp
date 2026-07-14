const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getRecordUuid() {
  try {
    // Find the most recent payment we created
    const payment = await prisma.payments.findFirst({
      where: {
        counteragent_uuid: 'B4968862-3843-414D-9E73-1A7611618B41',
        project_uuid: 'CFFC1C06-B78B-45A0-8A02-37A23706EAFC',
      },
      orderBy: {
        created_at: 'desc'
      },
      select: {
        record_uuid: true,
        payment_id: true,
        id: true,
        created_at: true,
      }
    });

    if (!payment) {
      console.log('❌ Payment record not found');
      return;
    }

    console.log('✅ Payment Record Details:\n');
    console.log('━'.repeat(60));
    console.log(`Record UUID:    ${payment.record_uuid}`);
    console.log(`Payment ID:     ${payment.payment_id}`);
    console.log(`DB ID:          ${payment.id}`);
    console.log(`Created:        ${payment.created_at}`);
    console.log('━'.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getRecordUuid();
