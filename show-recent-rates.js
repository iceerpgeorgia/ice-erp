const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showAllRecentRates() {
  try {
    const records = await prisma.nBGExchangeRate.findMany({
      orderBy: { date: 'desc' },
      take: 30
    });
    
    console.log('Last 30 records in Supabase:');
    records.forEach((r, i) => {
      console.log(`${i+1}. ${r.date.toISOString().split('T')[0]} - USD: ${r.usdRate}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showAllRecentRates();
