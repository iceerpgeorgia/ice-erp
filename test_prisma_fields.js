require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing counteragents fields...');
    const c = await prisma.counteragents.findFirst();
    console.log('\nCounteraget fields:', Object.keys(c).join(', '));
    
    console.log('\n\nTesting currencies fields...');
    const curr = await prisma.currencies.findFirst();
    console.log('\nCurrency fields:', Object.keys(curr).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
