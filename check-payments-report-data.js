const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  console.log('=== Checking Payments Report Data ===\n');
  
  // Count payments
  const paymentsCount = await prisma.payment.count({ where: { isActive: true } });
  console.log(`Active Payments: ${paymentsCount}`);
  
  // Count payments ledger
  const ledgerCount = await prisma.paymentLedger.count();
  console.log(`Payments Ledger Records: ${ledgerCount}`);
  
  // Count bank accounts with payment_uuid
  const bankAccountsCount = await prisma.consolidatedBankAccount.count({
    where: { paymentUuid: { not: null } }
  });
  console.log(`Bank Accounts with payment_uuid: ${bankAccountsCount}`);
  
  // Sample payments with their relationships
  console.log('\n=== Sample Payment Data ===');
  const samplePayments = await prisma.payment.findMany({
    where: { isActive: true },
    take: 3,
    include: {
      project: { select: { projectIndex: true } },
      counteragent: { select: { counteragent: true } },
      financialCode: { select: { validation: true, code: true } },
      job: { select: { jobName: true, floors: true } },
      currency: { select: { code: true } }
    }
  });
  
  samplePayments.forEach(p => {
    console.log(`\nPayment ID: ${p.paymentId}`);
    console.log(`  UUID: ${p.recordUuid}`);
    console.log(`  Counteragent: ${p.counteragent?.counteragent || 'N/A'}`);
    console.log(`  Project: ${p.project?.projectIndex || 'N/A'}`);
  });
  
  // Check if consolidated_bank_accounts.payment_uuid matches payments.record_uuid
  console.log('\n=== Checking UUID Format ===');
  const sampleBankAccount = await prisma.consolidatedBankAccount.findFirst({
    where: { paymentUuid: { not: null } },
    select: { paymentUuid: true }
  });
  
  if (sampleBankAccount) {
    console.log('Sample payment_uuid from bank account:', sampleBankAccount.paymentUuid);
    console.log('Type:', typeof sampleBankAccount.paymentUuid);
  }
  
  const samplePayment = await prisma.payment.findFirst({
    select: { recordUuid: true }
  });
  
  if (samplePayment) {
    console.log('Sample record_uuid from payment:', samplePayment.recordUuid);
    console.log('Type:', typeof samplePayment.recordUuid);
  }
  
  await prisma.$disconnect();
}

checkData().catch(console.error);
