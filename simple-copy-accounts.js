const { PrismaClient } = require('@prisma/client');

async function main() {
  const supabase = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1' } }
  });
  
  const local = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public' } }
  });

  try {
    console.log('Fetching from Supabase...');
    const accounts = await supabase.bankAccount.findMany({ orderBy: { createdAt: 'asc' } });
    console.log(`Found ${accounts.length} accounts`);
    
    console.log('\nClearing local (with CASCADE)...');
    await local.$executeRaw`TRUNCATE bank_accounts RESTART IDENTITY CASCADE`;
    
    console.log('Inserting into local...');
    for (const acc of accounts) {
      await local.bankAccount.create({
        data: {
          uuid: acc.uuid,
          accountNumber: acc.accountNumber,
          currencyUuid: acc.currencyUuid,
          bankUuid: acc.bankUuid,
          isActive: acc.isActive,
          createdAt: acc.createdAt,
          updatedAt: acc.updatedAt
        }
      });
    }
    
    console.log(`✓ Copied ${accounts.length} bank accounts`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await supabase.$disconnect();
    await local.$disconnect();
  }
}

main();
