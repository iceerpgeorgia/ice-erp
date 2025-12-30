const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testJobNames() {
  try {
    console.log('Checking payments with jobUuid...\n');
    
    const paymentsWithJobs = await prisma.payment.findMany({
      where: {
        jobUuid: { not: null },
        isActive: true,
      },
      select: {
        paymentId: true,
        jobUuid: true,
        projectUuid: true,
        counteragentUuid: true,
      },
      take: 5,
    });

    console.log(`Found ${paymentsWithJobs.length} payments with jobs\n`);
    
    for (const payment of paymentsWithJobs) {
      console.log(`Payment ID: ${payment.paymentId}`);
      console.log(`Job UUID: ${payment.jobUuid}`);
      
      // Try to find the job
      const job = await prisma.job.findUnique({
        where: { jobUuid: payment.jobUuid },
        select: { jobName: true, jobUuid: true },
      });
      
      if (job) {
        console.log(`✅ Job found: ${job.jobName}`);
      } else {
        console.log(`❌ Job NOT found for UUID: ${payment.jobUuid}`);
      }
      console.log('---\n');
    }

    // Also check total counts
    const totalPayments = await prisma.payment.count({ where: { isActive: true } });
    const paymentsWithJobCount = await prisma.payment.count({ 
      where: { isActive: true, jobUuid: { not: null } } 
    });
    const totalJobs = await prisma.job.count({ where: { isActive: true } });
    
    console.log(`\nSummary:`);
    console.log(`Total active payments: ${totalPayments}`);
    console.log(`Payments with jobs: ${paymentsWithJobCount}`);
    console.log(`Total active jobs: ${totalJobs}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testJobNames();
