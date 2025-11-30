const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteRates() {
  try {
    const result = await prisma.nBGExchangeRate.deleteMany({
      where: {
        date: {
          gte: new Date('2025-11-20')
        }
      }
    });
    console.log(`Deleted ${result.count} records from 2025-11-20 onwards`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteRates();
