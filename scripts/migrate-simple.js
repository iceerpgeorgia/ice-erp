// Simple migration script with real-time progress
const { PrismaClient } = require('@prisma/client');

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public',
    },
  },
});

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SUPABASE_DATABASE_URL,
    },
  },
});

async function migrateCountries() {
  console.log('\n📦 Migrating Countries...');
  
  const countries = await localPrisma.country.findMany();
  console.log(`   Found ${countries.length} countries in local database`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < countries.length; i++) {
    const country = countries[i];
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
      success++;
      process.stdout.write(`\r   Progress: ${i + 1}/${countries.length} (${success} created)`);
    } catch (error) {
      failed++;
      if (error.code !== 'P2002') {
        console.error(`\n   Error: ${error.message}`);
      }
    }
  }
  
  console.log(`\n   ✓ Done: ${success} created, ${failed} skipped/failed`);
}

async function migrateCounteragents() {
  console.log('\n📦 Migrating Counteragents...');
  
  const counteragents = await localPrisma.counteragent.findMany();
  console.log(`   Found ${counteragents.length} counteragents in local database`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < counteragents.length; i++) {
    const ca = counteragents[i];
    try {
      await prodPrisma.counteragent.create({
        data: {
          name: ca.name,
          identification_number: ca.identification_number,
          birth_or_incorporation_date: ca.birth_or_incorporation_date,
          entity_type: ca.entity_type,
          sex: ca.sex,
          country: ca.country,
          address_line_1: ca.address_line_1,
          address_line_2: ca.address_line_2,
          zip_code: ca.zip_code,
          iban: ca.iban,
          swift: ca.swift,
          director: ca.director,
          director_id: ca.director_id,
          email: ca.email,
          phone: ca.phone,
          oris_id: ca.oris_id,
          counteragent: ca.counteragent,
          country_uuid: ca.country_uuid,
          entity_type_uuid: ca.entity_type_uuid,
          counteragent_uuid: ca.counteragent_uuid,
          internal_number: ca.internal_number,
          pension_scheme: ca.pension_scheme,
          is_emploee: ca.is_emploee,
          is_active: ca.is_active,
          was_emploee: ca.was_emploee,
        },
      });
      success++;
      process.stdout.write(`\r   Progress: ${i + 1}/${counteragents.length} (${success} created)`);
    } catch (error) {
      failed++;
      if (error.code !== 'P2002') {
        console.error(`\n   Error: ${error.message}`);
      }
    }
  }
  
  console.log(`\n   ✓ Done: ${success} created, ${failed} skipped/failed`);
}

async function main() {
  console.log('=== Data Migration: Local → Supabase ===');
  
  try {
    await localPrisma.$connect();
    await prodPrisma.$connect();
    console.log('✓ Connected to both databases');
    
    await migrateCountries();
    await migrateCounteragents();
    
    // Final verification
    const prodCounts = await prodPrisma.$transaction([
      prodPrisma.country.count(),
      prodPrisma.counteragent.count(),
    ]);
    
    console.log('\n📊 Migration Complete!');
    console.log(`   Countries in Supabase: ${prodCounts[0]}`);
    console.log(`   Counteragents in Supabase: ${prodCounts[1]}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

main();
