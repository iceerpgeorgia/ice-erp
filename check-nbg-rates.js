const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRates() {
  try {
    const records = await prisma.nBGExchangeRate.findMany({
      orderBy: { date: 'desc' },
      take: 10
    });
    
    console.log('Last 10 records in Supabase database:');
    records.forEach(r => {
      console.log(`  ${r.date.toISOString().split('T')[0]} - USD: ${r.usdRate}`);
    });
    
    const count = await prisma.nBGExchangeRate.count();
    console.log(`\nTotal records: ${count}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRates();
