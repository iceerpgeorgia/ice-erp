const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('📝 Applying payment_id column to consolidated_bank_accounts...\n');

    // Read the SQL file
    const sql = fs.readFileSync('add-payment-id-to-consolidated.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 60) + '...');
        await prisma.$executeRawUnsafe(statement);
        console.log('✅ Done\n');
      }
    }

    // Verify the column was added
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'consolidated_bank_accounts' 
      AND column_name = 'payment_id'
    `;

    if (result && result.length > 0) {
      console.log('✅ Migration successful! payment_id column added to consolidated_bank_accounts');
      console.log('   Data type:', result[0].data_type);
    } else {
      console.log('⚠️  Warning: Could not verify column addition');
    }

    // Check if there are indexes
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'consolidated_bank_accounts' 
      AND indexname LIKE '%payment_id%'
    `;

    console.log('\n📊 Indexes on payment_id:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
