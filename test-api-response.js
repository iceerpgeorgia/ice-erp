// Test script to verify bank-transactions API returns payment_id and nominal_amount
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing bank-transactions API data...\n');
  
  // Fetch a sample of transactions with payment_id
  const transactions = await prisma.consolidatedBankAccount.findMany({
    where: {
      paymentId: { not: null }
    },
    include: {
      bankAccount: {
        include: {
          bank: true
        }
      }
    },
    take: 5
  });
  
  console.log(`Found ${transactions.length} transactions with payment_id\n`);
  
  transactions.forEach((row, idx) => {
    console.log(`Transaction ${idx + 1}:`);
    console.log(`  ID: ${row.id}`);
    console.log(`  Payment ID (raw): ${row.paymentId}`);
    console.log(`  Nominal Amount (raw): ${row.nominalAmount}`);
    console.log(`  Transaction Date: ${row.transactionDate}`);
    
    // Simulate API transformation
    const apiFormat = {
      id: Number(row.id),
      payment_id: row.paymentId ?? null,
      nominal_amount: row.nominalAmount?.toString() ?? null,
      transaction_date: row.transactionDate,
    };
    
    console.log(`  API Format:`, apiFormat);
    console.log('');
  });
  
  // Check total counts
  const totalCount = await prisma.consolidatedBankAccount.count();
  const withPaymentId = await prisma.consolidatedBankAccount.count({
    where: { paymentId: { not: null } }
  });
  const withNominalAmount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM consolidated_bank_accounts WHERE nominal_amount IS NOT NULL
  `;
  
  console.log('Summary:');
  console.log(`  Total transactions: ${totalCount}`);
  console.log(`  With payment_id: ${withPaymentId} (${((withPaymentId/totalCount)*100).toFixed(2)}%)`);
  console.log(`  With nominal_amount: ${withNominalAmount[0].count} (${((Number(withNominalAmount[0].count)/totalCount)*100).toFixed(2)}%)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
