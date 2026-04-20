const { PrismaClient } = require('@prisma/client');

// Check production database (if DIRECT_DATABASE_URL is set)
async function checkProductionDB() {
  const prodUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  
  console.log('Checking database:', prodUrl.includes('vercel') ? 'PRODUCTION (Vercel)' : 'LOCAL');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: prodUrl
      }
    }
  });

  try {
    const count = await prisma.attachments.count();
    console.log(`Total attachments: ${count}`);
    
    if (count > 0) {
      const samples = await prisma.attachments.findMany({
        take: 5,
        select: {
          file_name: true,
          created_at: true,
          is_active: true
        },
        orderBy: { created_at: 'desc' }
      });
      console.table(samples);
    } else {
      console.log('No attachments found in this database.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionDB();
