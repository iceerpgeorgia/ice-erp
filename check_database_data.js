const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkData() {
  console.log("\n" + "=".repeat(70));
  console.log("DATABASE DATA VERIFICATION");
  console.log("=".repeat(70));

  try {
    // 1. Total records
    console.log("\n1. TOTAL RECORDS:");
    const total = await prisma.consolidatedBankAccount.count();
    console.log(`   Total records: ${total.toLocaleString()}`);

    // 2. Records with payment_id
    console.log("\n2. RECORDS WITH PAYMENT_ID:");
    const withPayment = await prisma.consolidatedBankAccount.count({
      where: { paymentId: { not: null } }
    });
    console.log(`   Records with payment_id: ${withPayment.toLocaleString()} (${Math.round(withPayment*100/total)}%)`);

    // 3. Salary format payment IDs
    console.log("\n3. SALARY FORMAT PAYMENT IDS:");
    const salaryCount = await prisma.consolidatedBankAccount.count({
      where: { paymentId: { contains: "_NJ_", startsWith: "NP_" } }
    });
    console.log(`   Salary format count: ${salaryCount.toLocaleString()}`);

    // 4. Sample records with payment_id
    console.log("\n4. SAMPLE RECORDS WITH PAYMENT_ID:");
    const samples = await prisma.consolidatedBankAccount.findMany({
      where: { paymentId: { not: null } },
      select: { id: true, paymentId: true, docInformation: true },
      orderBy: { id: 'asc' },
      take: 10
    });
    samples.forEach(s => {
      const docInfo = s.docInformation ? s.docInformation.substring(0, 50) : 'NULL';
      console.log(`   ID ${s.id}: payment_id='${s.paymentId}', doc_info='${docInfo}'`);
    });

    // 5. Check specific record 329679
    console.log("\n5. SPECIFIC RECORD 329679:");
    const record = await prisma.consolidatedBankAccount.findUnique({
      where: { id: BigInt(329679) },
      select: {
        id: true,
        paymentId: true,
        docInformation: true,
        counteragentName: true,
        transactionDate: true
      }
    });
    if (record) {
      console.log(`   ID: ${record.id}`);
      console.log(`   Payment ID: ${record.paymentId || 'NULL'}`);
      console.log(`   DocInformation: ${record.docInformation || 'NULL'}`);
      console.log(`   Counteragent: ${record.counteragentName || 'NULL'}`);
      console.log(`   Transaction Date: ${record.transactionDate}`);
    } else {
      console.log("   ❌ Record not found!");
    }

    // 6. Check raw table
    console.log("\n6. RAW TABLE STATUS:");
    const rawTotal = await prisma.bogGelRaw893486000.count();
    console.log(`   Total raw records: ${rawTotal.toLocaleString()}`);
    
    const processedCount = await prisma.bogGelRaw893486000.count({
      where: { paymentIdProcessed: true }
    });
    console.log(`   payment_id_processed=TRUE: ${processedCount.toLocaleString()}`);

    console.log("\n" + "=".repeat(70));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
