// Test script to manually trigger the update and see what happens
const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testUpdate() {
  const recordId = BigInt(525977);
  
  console.log('Fetching current record...');
  const current = await prisma.consolidatedBankAccount.findUnique({
    where: { id: recordId }
  });
  
  if (!current) {
    console.error('Record not found!');
    return;
  }
  
  console.log('Current record:', {
    id: current.id.toString(),
    paymentId: current.paymentId,
    accountCurrencyAmount: current.accountCurrencyAmount.toString(),
    nominalCurrencyUuid: current.nominalCurrencyUuid,
    nominalAmount: current.nominalAmount.toString(),
  });
  
  // Test calculation
  const newNominalAmount = new Decimal('100.50');
  
  console.log('\nAttempting update...');
  const updated = await prisma.consolidatedBankAccount.update({
    where: { id: recordId },
    data: {
      nominalAmount: newNominalAmount,
    }
  });
  
  console.log('Updated record:', {
    id: updated.id.toString(),
    nominalAmount: updated.nominalAmount.toString(),
  });
  
  // Revert back
  console.log('\nReverting back...');
  await prisma.consolidatedBankAccount.update({
    where: { id: recordId },
    data: {
      nominalAmount: current.nominalAmount,
    }
  });
  
  console.log('Reverted successfully');
}

testUpdate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
