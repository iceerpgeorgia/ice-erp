const { PrismaClient } = require('@prisma/client');

// Local database (source)
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public',
    },
  },
});

// Supabase database (destination)
const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SUPABASE_DATABASE_URL,
    },
  },
});

async function main() {
  console.log('=== Entity Types Migration: Local → Supabase ===\n');

  try {
    // Test connections
    console.log('🔌 Testing connections...');
    await localPrisma.$queryRaw`SELECT 1`;
    await supabasePrisma.$queryRaw`SELECT 1`;
    console.log('✓ Connected to both databases\n');

    // Migrate entity types
    console.log('📦 Migrating Entity Types...');
    const localEntityTypes = await localPrisma.entityType.findMany({
      orderBy: { id: 'asc' },
    });
    
    console.log(`   Found ${localEntityTypes.length} entity types in local database`);
    
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const entityType of localEntityTypes) {
      try {
        // Check if already exists
        const existing = await supabasePrisma.entityType.findFirst({
          where: { entity_type_uuid: entityType.entity_type_uuid },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create in Supabase
        await supabasePrisma.entityType.create({
          data: {
            name_en: entityType.name_en,
            name_ka: entityType.name_ka,
            entity_type_uuid: entityType.entity_type_uuid,
            is_active: entityType.is_active,
          },
        });

        created++;
        
        // Progress indicator
        if ((created + skipped) % 10 === 0) {
          process.stdout.write(`\r   Progress: ${created + skipped}/${localEntityTypes.length} (${created} created, ${skipped} skipped)`);
        }
      } catch (error) {
        failed++;
        console.error(`\n   ⚠️  Failed to migrate entity type ${entityType.entity_type_uuid}:`, error.message);
      }
    }

    console.log(`\n   ✓ Done: ${created} created, ${skipped} skipped, ${failed} failed\n`);

    // Verification
    console.log('📊 Migration Complete!');
    const supabaseCount = await supabasePrisma.entityType.count();
    console.log(`   Entity Types in Supabase: ${supabaseCount}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
