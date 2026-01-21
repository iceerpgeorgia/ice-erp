require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCurrencies() {
  try {
    const currencies = await prisma.currencies.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        uuid: true
      }
    });

    console.log('\n📊 Currencies in Supabase:\n');
    if (currencies.length === 0) {
      console.log('   ❌ No currencies found!');
    } else {
      currencies.forEach(c => {
        console.log(`   ${c.code.padEnd(5)} - ${c.name.padEnd(30)} (${c.uuid})`);
      });
      console.log(`\n   Total: ${currencies.length} currencies`);
    }

    const gelExists = currencies.some(c => c.code === 'GEL');
    const usdExists = currencies.some(c => c.code === 'USD');

    console.log('\n✅ Required for template:');
    console.log(`   GEL: ${gelExists ? '✅ Found' : '❌ Missing'}`);
    console.log(`   USD: ${usdExists ? '✅ Found' : '❌ Missing'}`);
    console.log();

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrencies();
