const { prisma } = require('@/lib/prisma');

async function checkLastDate() {
  try {
    // Check last date in database
    const last = await prisma.nBGExchangeRate.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true }
    });
    
    console.log('📊 Last NBG rate date in database:', last?.date || 'NO DATA');
    
    // Check if Nov 19, 2025 exists
    const nov19 = await prisma.nBGExchangeRate.findFirst({
      where: { date: new Date('2025-11-19') }
    });
    
    console.log('🔍 Nov 19, 2025 exists:', nov19 ? 'YES ✅' : 'NO ❌');
    
    // Current date
    const now = new Date();
    console.log('📅 Today\'s date:', now.toISOString().split('T')[0]);
    
    // Calculate gap
    if (last) {
      const lastDate = new Date(last.date);
      const today = new Date(now.toISOString().split('T')[0]);
      const diffTime = today - lastDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      console.log('⏳ Gap:', diffDays, 'days');
      
      if (diffDays > 0) {
        console.log('⚠️  Missing rates for', diffDays, 'day(s)');
      } else {
        console.log('✅ Database is up to date');
      }
    }
    
    // Cron info
    console.log('\n⏰ Cron schedule: 19:00 UTC (23:00 Georgian time)');
    console.log('🕐 Current UTC time:', new Date().toISOString().replace('T', ' ').substring(0, 19));
    
    const utcHour = now.getUTCHours();
    if (utcHour < 19) {
      console.log('⏳ Cron has NOT run yet today (runs at 19:00 UTC)');
    } else {
      console.log('✅ Cron should have run today');
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

checkLastDate();
