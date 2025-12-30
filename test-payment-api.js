const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPaymentOptionsAPI() {
  try {
    // Find a transaction that has a payment with a job
    const payment = await prisma.payment.findFirst({
      where: {
        jobUuid: { not: null },
        isActive: true,
      },
      select: {
        paymentId: true,
        counteragentUuid: true,
        jobUuid: true,
      },
    });

    if (!payment) {
      console.log('No payment with job found');
      return;
    }

    console.log('Found payment:', payment.paymentId);
    console.log('Counteragent UUID:', payment.counteragentUuid);

    // Find a transaction for this counteragent
    const transaction = await prisma.consolidatedBankAccount.findFirst({
      where: {
        counteragentUuid: payment.counteragentUuid,
      },
      select: {
        id: true,
        counteragentUuid: true,
      },
    });

    if (!transaction) {
      console.log('No transaction found for this counteragent');
      return;
    }

    console.log('\nTransaction ID:', transaction.id.toString());
    console.log('\nNow simulating API call...\n');

    // Simulate what the API does
    const payments = await prisma.payment.findMany({
      where: {
        counteragentUuid: transaction.counteragentUuid,
        isActive: true,
      },
      select: {
        paymentId: true,
        projectUuid: true,
        financialCodeUuid: true,
        currencyUuid: true,
        jobUuid: true,
      },
      orderBy: {
        paymentId: 'asc',
      },
    });

    console.log(`Found ${payments.length} payment(s) for this counteragent\n`);

    // Fetch related data for each payment
    const paymentsWithDetails = await Promise.all(
      payments.map(async (payment) => {
        const [currency, project, job, financialCode] = await Promise.all([
          payment.currencyUuid
            ? prisma.currency.findUnique({
                where: { uuid: payment.currencyUuid },
                select: { code: true },
              })
            : null,
          payment.projectUuid
            ? prisma.project.findUnique({
                where: { projectUuid: payment.projectUuid },
                select: { projectName: true },
              })
            : null,
          payment.jobUuid
            ? prisma.job.findUnique({
                where: { jobUuid: payment.jobUuid },
                select: { jobName: true },
              })
            : null,
          payment.financialCodeUuid
            ? prisma.financialCode.findUnique({
                where: { uuid: payment.financialCodeUuid },
                select: { validation: true },
              })
            : null,
        ]);

        return {
          paymentId: payment.paymentId,
          projectUuid: payment.projectUuid,
          financialCodeUuid: payment.financialCodeUuid,
          currencyUuid: payment.currencyUuid,
          jobUuid: payment.jobUuid,
          currencyCode: currency?.code || '',
          projectName: project?.projectName || '',
          jobName: job?.jobName || '',
          financialCodeValidation: financialCode?.validation || '',
        };
      })
    );

    console.log('API Response would be:');
    console.log(JSON.stringify(paymentsWithDetails, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentOptionsAPI();
