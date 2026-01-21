const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const counts = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int as total,
      COUNT(correction_date)::int as with_correction,
      COUNT(exchange_rate)::int as with_rate
    FROM consolidated_bank_accounts
  `;
  
  console.log('Database statistics:');
  console.log('  Total records:', counts[0].total);
  console.log('  With correction_date:', counts[0].with_correction);
  console.log('  With exchange_rate:', counts[0].with_rate);
  console.log('  Missing columns:', counts[0].total - counts[0].with_rate);
  console.log('  Coverage:', ((counts[0].with_rate / counts[0].total) * 100).toFixed(2) + '%');
  
})().finally(() => prisma.$disconnect());
