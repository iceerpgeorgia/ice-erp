const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function syncBankTransactions() {
  const localPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  const supabasePrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.REMOTE_DATABASE_URL
      }
    }
  });

  try {
    console.log('🔄 Syncing bank transactions from Supabase to local...\n');
    
    // Fetch all records from Supabase
    console.log('📥 Fetching records from Supabase...');
    const supabaseRecords = await supabasePrisma.consolidatedBankAccount.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`✓ Found ${supabaseRecords.length} records\n`);
    
    // Check local count
    const localCount = await localPrisma.consolidatedBankAccount.count();
    console.log(`📊 Current local records: ${localCount}\n`);
    
    if (localCount > 0) {
      console.log('⚠️  Local database already has records. Clear first? (Y/N)');
      console.log('   Continuing anyway - will skip duplicates...\n');
    }
    
    // Insert records into local database
    console.log('📤 Inserting records into local database...');
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < supabaseRecords.length; i++) {
      const record = supabaseRecords[i];
      
      try {
        await localPrisma.consolidatedBankAccount.create({
          data: {
            uuid: record.uuid,
            accountUuid: record.accountUuid,
            accountCurrencyUuid: record.accountCurrencyUuid,
            accountCurrencyAmount: record.accountCurrencyAmount,
            paymentUuid: record.paymentUuid,
            counteragentUuid: record.counteragentUuid,
            projectUuid: record.projectUuid,
            financialCodeUuid: record.financialCodeUuid,
            nominalCurrencyUuid: record.nominalCurrencyUuid,
            nominalAmount: record.nominalAmount,
            date: record.date,
            correctionDate: record.correctionDate,
            id1: record.id1,
            id2: record.id2,
            recordUuid: record.recordUuid,
            counteragentAccountNumber: record.counteragentAccountNumber,
            description: record.description,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
          }
        });
        inserted++;
        
        if ((i + 1) % 50 === 0) {
          console.log(`   Progress: ${i + 1}/${supabaseRecords.length} (${inserted} inserted, ${skipped} skipped, ${errors} errors)`);
        }
      } catch (error) {
        if (error.code === 'P2002') {
          // Unique constraint violation - record already exists
          skipped++;
        } else {
          console.error(`   Error inserting record ${i + 1}:`, error.message.substring(0, 100));
          errors++;
        }
      }
    }
    
    console.log(`\n✅ Sync completed!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Errors:   ${errors}`);
    
    // Verify
    const newLocalCount = await localPrisma.consolidatedBankAccount.count();
    console.log(`\n📊 New local count: ${newLocalCount}`);
    console.log(`📊 Supabase count: ${supabaseRecords.length}`);
    
    if (newLocalCount === supabaseRecords.length) {
      console.log('\n🎉 Databases are now in sync!');
    } else {
      console.log(`\n⚠️  Still ${supabaseRecords.length - newLocalCount} records difference`);
    }
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error);
  } finally {
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

syncBankTransactions();
