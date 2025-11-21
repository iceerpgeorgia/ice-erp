// Check NBG Exchange Rates
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNBGRates() {
  try {
    console.log('🔍 Checking NBG Exchange Rates...\n');

    // Get the most recent rate
    const latestRate = await prisma.nBGExchangeRate.findFirst({
      orderBy: { date: 'desc' }
    });

    if (!latestRate) {
      console.log('❌ No NBG rates found in database!');
      console.log('   Run: node scripts/update-nbg-rates.py or use the UI button');
      await prisma.$disconnect();
      return;
    }

    console.log('📊 Latest NBG Exchange Rates:');
    console.log(`   Date: ${latestRate.date.toISOString().split('T')[0]}`);
    console.log(`   Updated: ${latestRate.updatedAt.toISOString()}`);
    console.log('\n💱 Rates (to GEL):');
    console.log(`   USD: ${latestRate.usdRate ? Number(latestRate.usdRate).toFixed(6) : 'N/A'}`);
    console.log(`   EUR: ${latestRate.eurRate ? Number(latestRate.eurRate).toFixed(6) : 'N/A'}`);
    console.log(`   CNY: ${latestRate.cnyRate ? Number(latestRate.cnyRate).toFixed(6) : 'N/A'}`);
    console.log(`   GBP: ${latestRate.gbpRate ? Number(latestRate.gbpRate).toFixed(6) : 'N/A'}`);
    console.log(`   RUB: ${latestRate.rubRate ? Number(latestRate.rubRate).toFixed(6) : 'N/A'}`);
    console.log(`   TRY: ${latestRate.tryRate ? Number(latestRate.tryRate).toFixed(6) : 'N/A'}`);
    console.log(`   AED: ${latestRate.aedRate ? Number(latestRate.aedRate).toFixed(6) : 'N/A'}`);
    console.log(`   KZT: ${latestRate.kztRate ? Number(latestRate.kztRate).toFixed(6) : 'N/A'}`);

    // Count total rates
    const totalRates = await prisma.nBGExchangeRate.count();
    console.log(`\n📈 Total rates in database: ${totalRates}`);

    // Get date range
    const oldestRate = await prisma.nBGExchangeRate.findFirst({
      orderBy: { date: 'asc' }
    });
    
    if (oldestRate) {
      console.log(`   Date range: ${oldestRate.date.toISOString().split('T')[0]} to ${latestRate.date.toISOString().split('T')[0]}`);
    }

    // Check for gaps in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRates = await prisma.nBGExchangeRate.findMany({
      where: {
        date: { gte: thirtyDaysAgo }
      },
      orderBy: { date: 'asc' }
    });

    console.log(`\n📅 Rates in last 30 days: ${recentRates.length}`);

    // Check for missing days
    const today = new Date();
    const expectedDays = Math.floor((today - thirtyDaysAgo) / (1000 * 60 * 60 * 24));
    const missingDays = expectedDays - recentRates.length;

    if (missingDays > 0) {
      console.log(`   ⚠️ Missing ${missingDays} day(s) of data`);
    } else {
      console.log(`   ✅ Complete data (no gaps)`);
    }

    // Check today's rate
    const todayStr = today.toISOString().split('T')[0];
    const todayRate = await prisma.nBGExchangeRate.findUnique({
      where: { date: new Date(todayStr) }
    });

    if (todayRate) {
      console.log(`\n✅ Today's rate (${todayStr}) is available`);
    } else {
      console.log(`\n⚠️ Today's rate (${todayStr}) not yet available`);
      console.log(`   Latest available: ${latestRate.date.toISOString().split('T')[0]}`);
      
      const daysDiff = Math.floor((today - latestRate.date) / (1000 * 60 * 60 * 24));
      if (daysDiff > 3) {
        console.log(`   ❌ Data is ${daysDiff} days old - cron job may not be running!`);
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkNBGRates();
