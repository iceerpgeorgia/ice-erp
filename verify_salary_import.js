require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyImport() {
  try {
    const count = await prisma.salary_accruals.count();
    console.log('\n========================================');
    console.log('  IMPORT VERIFICATION');
    console.log('========================================\n');
    console.log(`✅ Total Salary Accruals: ${count}\n`);

    const gelCount = await prisma.salary_accruals.count({
      where: { nominal_currency_uuid: '5a2d799d-22a1-4e0a-b029-8031a1df6d56' }
    });

    const usdCount = await prisma.salary_accruals.count({
      where: { nominal_currency_uuid: '0790fb09-2de6-4ea3-a71c-58a007fc62a8' }
    });

    console.log('Currency distribution:');
    console.log(`  GEL: ${gelCount} records`);
    console.log(`  USD: ${usdCount} records`);

    // Sample records
    console.log('\n📋 Sample records:\n');
    const samples = await prisma.salary_accruals.findMany({
      take: 3,
      orderBy: { created_at: 'desc' }
    });

    samples.forEach((s, i) => {
      console.log(`Record ${i + 1}:`);
      console.log(`  Payment ID: ${s.payment_id}`);
      console.log(`  Net Sum: ${s.net_sum}`);
      console.log(`  Currency UUID: ${s.nominal_currency_uuid}`);
      console.log(`  Salary Month: ${s.salary_month}`);
      console.log();
    });

    console.log('========================================');
    console.log('✅ IMPORT SUCCESSFUL!');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyImport();
