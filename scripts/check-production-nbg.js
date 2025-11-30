// Check NBG Rates in Production Supabase Database
const { PrismaClient } = require('@prisma/client');

// Use production DATABASE_URL from environment
const prisma = new PrismaClient();

async function checkProductionNBGRates() {
  try {
    console.log('🔍 Checking NBG Rates in Production Supabase...\n');

    // Get the most recent rate
    const latestRate = await prisma.nBGExchangeRate.findFirst({
      orderBy: { date: 'desc' }
    });

    if (!latestRate) {
      console.log('❌ No NBG rates found!');
      await prisma.$disconnect();
      return;
    }

    console.log('📊 Latest NBG Exchange Rate:');
    console.log(`   Date: ${latestRate.date.toISOString().split('T')[0]}`);
    console.log(`   Last Updated: ${latestRate.updatedAt.toISOString()}`);
    console.log('\n💱 Current Rates (to GEL):');
    console.log(`   USD: ${latestRate.usdRate ? Number(latestRate.usdRate).toFixed(6) : 'N/A'}`);
    console.log(`   EUR: ${latestRate.eurRate ? Number(latestRate.eurRate).toFixed(6) : 'N/A'}`);
    console.log(`   CNY: ${latestRate.cnyRate ? Number(latestRate.cnyRate).toFixed(6) : 'N/A'}`);
    console.log(`   GBP: ${latestRate.gbpRate ? Number(latestRate.gbpRate).toFixed(6) : 'N/A'}`);
    console.log(`   RUB: ${latestRate.rubRate ? Number(latestRate.rubRate).toFixed(6) : 'N/A'}`);
    console.log(`   TRY: ${latestRate.tryRate ? Number(latestRate.tryRate).toFixed(6) : 'N/A'}`);
    console.log(`   AED: ${latestRate.aedRate ? Number(latestRate.aedRate).toFixed(6) : 'N/A'}`);
    console.log(`   KZT: ${latestRate.kztRate ? Number(latestRate.kztRate).toFixed(6) : 'N/A'}`);

    // Check if it's today's rate
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const latestStr = latestRate.date.toISOString().split('T')[0];

    console.log('');
    if (todayStr === latestStr) {
      console.log(`✅ Today's rate (${todayStr}) is UP TO DATE!`);
    } else {
      const daysDiff = Math.floor((today - latestRate.date) / (1000 * 60 * 60 * 24));
      console.log(`⚠️  Latest rate is from ${latestStr}`);
      console.log(`   That's ${daysDiff} day(s) ago`);
    }

    // Get total count
    const totalRates = await prisma.nBGExchangeRate.count();
    console.log(`\n📈 Total rates in database: ${totalRates}`);

    // Get recent rates
    const recentRates = await prisma.nBGExchangeRate.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      select: {
        date: true,
        usdRate: true,
        updatedAt: true
      }
    });

    console.log('\n📅 Last 10 rate updates:');
    recentRates.forEach((rate, i) => {
      const dateStr = rate.date.toISOString().split('T')[0];
      const updatedStr = rate.updatedAt.toISOString().replace('T', ' ').split('.')[0];
      const usdRate = rate.usdRate ? Number(rate.usdRate).toFixed(4) : 'N/A';
      console.log(`   ${i + 1}. ${dateStr} - USD: ${usdRate} - Updated: ${updatedStr}`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkProductionNBGRates();
