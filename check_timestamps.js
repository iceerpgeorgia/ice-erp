const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTimestamps() {
  console.log("\n=== CONSOLIDATED TABLE ANALYSIS ===\n");
  
  // Total records
  const total = await prisma.consolidatedBankAccount.count();
  console.log(`Total records: ${total.toLocaleString()}`);
  
  // Timestamps
  const agg = await prisma.consolidatedBankAccount.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true, updatedAt: true }
  });
  console.log(`Oldest createdAt: ${agg._min.createdAt}`);
  console.log(`Newest createdAt: ${agg._max.createdAt}`);
  console.log(`Newest updatedAt: ${agg._max.updatedAt}`);
  
  // Records with payment_id
  const withPayment = await prisma.consolidatedBankAccount.count({
    where: { paymentId: { not: null } }
  });
  console.log(`\nRecords with payment_id: ${withPayment.toLocaleString()} (${Math.round(withPayment*100/total)}%)`);
  
  //Salary format
  const salaryLike = await prisma.consolidatedBankAccount.count({
    where: { 
      paymentId: {
        contains: "_NJ_"
      }
    }
  });
  console.log(`Salary format (_NJ_ pattern): ${salaryLike.toLocaleString()}`);
  
  // Sample payment IDs
  console.log("\nSample payment IDs:");
  const samples = await prisma.consolidatedBankAccount.findMany({
    where: { paymentId: { not: null } },
    select: { id: true, paymentId: true },
    orderBy: { id: 'asc' },
    take: 20
  });
  samples.forEach(s => {
    const isSalary = s.paymentId && s.paymentId.includes('_NJ_') ? ' ← SALARY FORMAT' : '';
    console.log(`  ID ${s.id}: ${s.paymentId}${isSalary}`);
  });
  
  await prisma.$disconnect();
}

checkTimestamps().catch(console.error);
