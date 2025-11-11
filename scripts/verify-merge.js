const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SUPABASE_DATABASE_URL || 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public'
    },
  },
});

async function verify() {
  console.log('🔍 Verifying merged data...\n');

  // Check how many have country_uuid and entity_type_uuid now
  const withCountry = await prisma.counteragent.count({
    where: { country_uuid: { not: null } }
  });

  const withEntityType = await prisma.counteragent.count({
    where: { entity_type_uuid: { not: null } }
  });

  const total = await prisma.counteragent.count();

  console.log(`📊 Statistics:`);
  console.log(`   Total counteragents: ${total}`);
  console.log(`   With country_uuid: ${withCountry} (${(withCountry/total*100).toFixed(1)}%)`);
  console.log(`   With entity_type_uuid: ${withEntityType} (${(withEntityType/total*100).toFixed(1)}%)`);

  // Show sample records
  console.log(`\n📋 Sample records with merged data:`);
  const samples = await prisma.counteragent.findMany({
    where: {
      AND: [
        { country_uuid: { not: null } },
        { entity_type_uuid: { not: null } }
      ]
    },
    select: {
      name: true,
      country: true,
      country_uuid: true,
      entity_type: true,
      entity_type_uuid: true
    },
    take: 5
  });

  samples.forEach((ca, i) => {
    console.log(`\n${i + 1}. ${ca.name || 'N/A'}`);
    console.log(`   Country: ${ca.country || 'N/A'} (UUID: ${ca.country_uuid?.substring(0, 8)}...)`);
    console.log(`   Entity Type: ${ca.entity_type || 'N/A'} (UUID: ${ca.entity_type_uuid?.substring(0, 8)}...)`);
  });

  await prisma.$disconnect();
}

verify().catch(console.error);
