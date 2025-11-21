// Check for duplicate identification numbers
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('🔍 Checking for duplicate identification numbers...\n');

    const duplicates = await prisma.$queryRaw`
      SELECT 
        identification_number, 
        COUNT(*) as count,
        ARRAY_AGG(counteragent_uuid::text ORDER BY created_at) as uuids,
        ARRAY_AGG(name ORDER BY created_at) as names,
        ARRAY_AGG(created_at::text ORDER BY created_at) as created_dates
      FROM counteragents
      WHERE identification_number IS NOT NULL
      GROUP BY identification_number
      HAVING COUNT(*) > 1
      ORDER BY count DESC, identification_number
    `;

    if (duplicates.length === 0) {
      console.log('✅ No duplicate identification numbers found!');
    } else {
      console.log(`❌ Found ${duplicates.length} duplicate identification number(s):\n`);
      
      duplicates.forEach((dup, index) => {
        console.log(`\n📌 Duplicate #${index + 1}:`);
        console.log(`   ID Number: ${dup.identification_number}`);
        console.log(`   Count: ${dup.count}`);
        console.log(`   Names: ${dup.names.join(', ')}`);
        console.log(`   UUIDs:`);
        dup.uuids.forEach((uuid, i) => {
          console.log(`     ${i + 1}. ${uuid} (created: ${dup.created_dates[i]})`);
        });
      });

      console.log('\n📝 To resolve:');
      console.log('   Option A: Delete duplicate entry');
      console.log('   Option B: Update identification_number to a different value');
      console.log('   Option C: Merge records if they represent the same entity');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkDuplicates();
