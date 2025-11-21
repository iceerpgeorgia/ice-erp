const { PrismaClient } = require('@prisma/client');

const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SUPABASE_DATABASE_URL,
    },
  },
});

async function checkTables() {
  console.log('🔍 Checking Supabase Tables...\n');

  try {
    // Check entity_types table
    console.log('📋 Entity Types Table:');
    const entityTypes = await supabasePrisma.entityType.findMany({
      take: 5,
    });
    console.log(`   Total count: ${await supabasePrisma.entityType.count()}`);
    console.log('   Sample records:');
    entityTypes.forEach(et => {
      console.log(`   - ${et.code}: ${et.name_ka} (${et.name_en})`);
      console.log(`     UUID: ${et.entity_type_uuid}`);
    });

    console.log('\n📋 Counteragents Table:');
    const counteragents = await supabasePrisma.counteragent.findMany({
      take: 5,
    });
    console.log(`   Total count: ${await supabasePrisma.counteragent.count()}`);
    console.log('   Sample records:');
    counteragents.forEach(ca => {
      console.log(`   - ${ca.name || 'N/A'}`);
      console.log(`     Entity Type: ${ca.entity_type || 'N/A'}`);
      console.log(`     ID: ${ca.identification_number || 'N/A'}`);
    });

    console.log('\n📋 Countries Table:');
    const countries = await supabasePrisma.country.findMany({
      take: 5,
    });
    console.log(`   Total count: ${await supabasePrisma.country.count()}`);
    console.log('   Sample records:');
    countries.forEach(c => {
      console.log(`   - ${c.name_en} (${c.name_ka}) - ${c.iso2}`);
    });

    console.log('\n✅ Table check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await supabasePrisma.$disconnect();
  }
}

checkTables();
