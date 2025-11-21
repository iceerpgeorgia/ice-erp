const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

// Function to create Prisma client for specific database
function createPrismaClient(databaseUrl) {
  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });
}

async function mergeCounterагentData(prisma, dbName) {
  console.log(`\n📦 Merging data for ${dbName}...`);

  // Read Excel file
  const excelPath = path.join(process.cwd(), 'Merge Data Counteragents.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`   Found ${data.length} records in Excel\n`);

  // First, load all countries and entity types for lookup
  const countries = await prisma.country.findMany({
    select: { country_uuid: true, country: true, name_en: true }
  });
  
  const entityTypes = await prisma.entityType.findMany({
    select: { entity_type_uuid: true, name_ka: true }
  });

  // Create lookup maps
  const countryMap = new Map(countries.map(c => [c.country_uuid.toLowerCase(), c]));
  const entityTypeMap = new Map(entityTypes.map(et => [et.entity_type_uuid.toLowerCase(), et]));

  console.log(`   Loaded ${countries.length} countries and ${entityTypes.length} entity types for lookup\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;
  const notFoundUUIDs = [];

  for (const row of data) {
    try {
      const counteragentUuid = row['UUID']?.trim().toLowerCase();
      const countryUuid = row['Country UUID']?.trim().toLowerCase();
      const entityTypeUuid = row['Entity Types']?.trim().toLowerCase();

      if (!counteragentUuid) {
        errors++;
        continue;
      }

      // Find counteragent by UUID
      const counteragent = await prisma.counteragent.findFirst({
        where: { counteragent_uuid: counteragentUuid }
      });

      if (!counteragent) {
        notFound++;
        notFoundUUIDs.push(counteragentUuid);
        continue;
      }

      // Lookup country and entity type names
      const country = countryUuid ? countryMap.get(countryUuid) : null;
      const entityType = entityTypeUuid ? entityTypeMap.get(entityTypeUuid) : null;

      // Prepare update data
      const updateData = {};
      
      if (countryUuid) {
        updateData.country_uuid = countryUuid;
        updateData.country = country ? (country.country || country.name_en) : null;
      }
      
      if (entityTypeUuid) {
        updateData.entity_type_uuid = entityTypeUuid;
        updateData.entity_type = entityType ? entityType.name_ka : null;
      }

      // Update counteragent
      await prisma.counteragent.update({
        where: { id: counteragent.id },
        data: updateData
      });

      updated++;

      // Progress indicator
      if (updated % 100 === 0) {
        process.stdout.write(`\r   Progress: ${updated}/${data.length} updated, ${notFound} not found`);
      }

    } catch (error) {
      errors++;
      console.error(`\n   ⚠️  Error updating ${row['UUID']}:`, error.message);
    }
  }

  console.log(`\n\n   ✓ Done: ${updated} updated, ${notFound} not found, ${errors} errors`);
  
  if (notFoundUUIDs.length > 0 && notFoundUUIDs.length <= 10) {
    console.log(`\n   Not found UUIDs (first 10):`, notFoundUUIDs.slice(0, 10));
  }

  return { updated, notFound, errors };
}

async function main() {
  console.log('=== Counteragents Data Merge ===\n');

  const localUrl = 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public';
  const supabaseUrl = process.env.SUPABASE_DATABASE_URL;

  if (!supabaseUrl) {
    console.error('❌ SUPABASE_DATABASE_URL environment variable not set');
    console.log('\nPlease run:');
    console.log('$env:SUPABASE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"');
    process.exit(1);
  }

  // Merge local database
  console.log('🔹 Processing LOCAL database...');
  const localPrisma = createPrismaClient(localUrl);
  const localResults = await mergeCounterагentData(localPrisma, 'LOCAL');
  await localPrisma.$disconnect();

  // Merge Supabase database
  console.log('\n🔹 Processing SUPABASE database...');
  const supabasePrisma = createPrismaClient(supabaseUrl);
  const supabaseResults = await mergeCounterагentData(supabasePrisma, 'SUPABASE');
  await supabasePrisma.$disconnect();

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Local: ${localResults.updated} updated, ${localResults.notFound} not found, ${localResults.errors} errors`);
  console.log(`   Supabase: ${supabaseResults.updated} updated, ${supabaseResults.notFound} not found, ${supabaseResults.errors} errors`);
  console.log('\n✅ Merge complete!');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
