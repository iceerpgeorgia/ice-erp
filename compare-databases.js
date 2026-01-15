const { PrismaClient } = require('@prisma/client');

// Local database
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public'
    }
  }
});

// Supabase (assuming you have this in env)
const supabaseUrl = process.env.SUPABASE_DATABASE_URL || 'postgresql://postgres.ikeojigdmgqdfcjqyoio:fulebimojviT1985%25@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: supabaseUrl
    }
  }
});

async function compareDatabases() {
  try {
    console.log('Comparing consolidated_bank_accounts...\n');

    const localCount = await localPrisma.$queryRaw`SELECT COUNT(*) as count, COUNT(payment_id) as with_payment_id FROM consolidated_bank_accounts`;
    console.log('LOCAL database:');
    console.log(`  Total: ${localCount[0].count}`);
    console.log(`  With payment_id: ${localCount[0].with_payment_id}`);
    console.log(`  Percentage: ${(Number(localCount[0].with_payment_id) / Number(localCount[0].count) * 100).toFixed(2)}%`);

    const supabaseCount = await supabasePrisma.$queryRaw`SELECT COUNT(*) as count, COUNT(payment_id) as with_payment_id FROM consolidated_bank_accounts`;
    console.log('\nSUPABASE database:');
    console.log(`  Total: ${supabaseCount[0].count}`);
    console.log(`  With payment_id: ${supabaseCount[0].with_payment_id}`);
    console.log(`  Percentage: ${(Number(supabaseCount[0].with_payment_id) / Number(supabaseCount[0].count) * 100).toFixed(2)}%`);

    console.log('\n\nWebapp (using .env DATABASE_URL) connects to: LOCAL');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

compareDatabases();
