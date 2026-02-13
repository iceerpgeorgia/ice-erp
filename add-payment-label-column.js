const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addPaymentLabelColumn() {
  try {
    await prisma.$executeRaw`
      ALTER TABLE payments
      ADD COLUMN IF NOT EXISTS label TEXT
    `;

    console.log('✓ Column added successfully');
    console.log('  - label TEXT');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addPaymentLabelColumn();
