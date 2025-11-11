// scripts/migrate-data.ts
// Migrates countries and counteragents from local to production database

import { PrismaClient } from '@prisma/client';

console.log('Initializing Prisma clients...');

// Local database client
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public',
    },
  },
  log: ['error', 'warn'],
});

// Production database client (Supabase)
// You need to set SUPABASE_DATABASE_URL in your environment
const prodDatabaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!prodDatabaseUrl) {
  console.error('❌ Error: SUPABASE_DATABASE_URL environment variable is required');
  console.log('\nUsage:');
  console.log('  $env:SUPABASE_DATABASE_URL="postgresql://postgres.fojbzghphznbslqwurrm:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"');
  console.log('  pnpm migrate-data');
  process.exit(1);
}

console.log('Production DB URL:', prodDatabaseUrl.replace(/:[^:@]+@/, ':****@'));

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDatabaseUrl,
    },
  },
  log: ['error', 'warn'],
});

async function migrateCountries() {
  console.log('\n📦 Migrating countries...');
  
  try {
    // Fetch all countries from local
    const countries = await localPrisma.country.findMany({
      orderBy: { id: 'asc' },
    });
    
    console.log(`   Found ${countries.length} countries in local database`);
    
    if (countries.length === 0) {
      console.log('   ⚠️  No countries to migrate');
      return;
    }
    
    // Check existing in production
    const existingCount = await prodPrisma.country.count();
    console.log(`   Found ${existingCount} countries already in production`);
    
    if (existingCount > 0) {
      console.log('   ⚠️  Production database already has countries');
      console.log('   Skipping to avoid duplicates. Delete existing records first if you want to reimport.');
      return;
    }
    
    // Insert countries one by one to handle any conflicts
    let successCount = 0;
    let skipCount = 0;
    
    for (const country of countries) {
      try {
        await prodPrisma.country.create({
          data: {
            name_en: country.name_en,
            name_ka: country.name_ka,
            iso2: country.iso2,
            iso3: country.iso3,
            un_code: country.un_code,
            country: country.country,
            is_active: country.is_active,
            country_uuid: country.country_uuid,
          },
        });
        successCount++;
        process.stdout.write(`\r   Progress: ${successCount}/${countries.length}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          skipCount++;
        } else {
          console.error(`\n   ✗ Error importing ${country.name_en}:`, error.message);
        }
      }
    }
    
    console.log(`\n   ✓ Countries migrated: ${successCount} created, ${skipCount} skipped`);
  } catch (error) {
    console.error('   ✗ Error migrating countries:', error);
    throw error;
  }
}

async function migrateCounteragents() {
  console.log('\n📦 Migrating counteragents...');
  
  try {
    // Fetch all counteragents from local
    const counteragents = await localPrisma.counteragent.findMany({
      orderBy: { id: 'asc' },
    });
    
    console.log(`   Found ${counteragents.length} counteragents in local database`);
    
    if (counteragents.length === 0) {
      console.log('   ⚠️  No counteragents to migrate');
      return;
    }
    
    // Check existing in production
    const existingCount = await prodPrisma.counteragent.count();
    console.log(`   Found ${existingCount} counteragents already in production`);
    
    if (existingCount > 0) {
      console.log('   ⚠️  Production database already has counteragents');
      console.log('   Skipping to avoid duplicates. Delete existing records first if you want to reimport.');
      return;
    }
    
    // Insert counteragents in batches
    let successCount = 0;
    let skipCount = 0;
    
    for (const counteragent of counteragents) {
      try {
        await prodPrisma.counteragent.create({
          data: {
            name: counteragent.name,
            identification_number: counteragent.identification_number,
            birth_or_incorporation_date: counteragent.birth_or_incorporation_date,
            entity_type: counteragent.entity_type,
            sex: counteragent.sex,
            country: counteragent.country,
            address_line_1: counteragent.address_line_1,
            address_line_2: counteragent.address_line_2,
            zip_code: counteragent.zip_code,
            iban: counteragent.iban,
            swift: counteragent.swift,
            director: counteragent.director,
            director_id: counteragent.director_id,
            email: counteragent.email,
            phone: counteragent.phone,
            oris_id: counteragent.oris_id,
            counteragent: counteragent.counteragent,
            country_uuid: counteragent.country_uuid,
            entity_type_uuid: counteragent.entity_type_uuid,
            counteragent_uuid: counteragent.counteragent_uuid,
            internal_number: counteragent.internal_number,
            pension_scheme: counteragent.pension_scheme,
            is_emploee: counteragent.is_emploee,
            is_active: counteragent.is_active,
            was_emploee: counteragent.was_emploee,
          },
        });
        successCount++;
        process.stdout.write(`\r   Progress: ${successCount}/${counteragents.length}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          skipCount++;
        } else {
          console.error(`\n   ✗ Error importing counteragent:`, error.message);
        }
      }
    }
    
    console.log(`\n   ✓ Counteragents migrated: ${successCount} created, ${skipCount} skipped`);
  } catch (error) {
    console.error('   ✗ Error migrating counteragents:', error);
    throw error;
  }
}

async function main() {
  console.log('=== Data Migration: Local → Supabase Production ===\n');
  
  try {
    // Test connections
    console.log('🔌 Testing database connections...');
    await localPrisma.$connect();
    console.log('   ✓ Local database connected');
    await prodPrisma.$connect();
    console.log('   ✓ Production database connected');
    
    // Migrate data
    await migrateCountries();
    await migrateCounteragents();
    
    // Final summary
    console.log('\n📊 Final Summary:');
    const localCounts = await localPrisma.$transaction([
      localPrisma.country.count(),
      localPrisma.counteragent.count(),
    ]);
    const prodCounts = await prodPrisma.$transaction([
      prodPrisma.country.count(),
      prodPrisma.counteragent.count(),
    ]);
    
    console.log('   Local Database:');
    console.log(`     - Countries: ${localCounts[0]}`);
    console.log(`     - Counteragents: ${localCounts[1]}`);
    console.log('   Production Database (Supabase):');
    console.log(`     - Countries: ${prodCounts[0]}`);
    console.log(`     - Counteragents: ${prodCounts[1]}`);
    
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

main();
