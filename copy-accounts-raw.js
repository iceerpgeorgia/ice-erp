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
    const accounts = await supabase.$queryRaw`SELECT * FROM bank_accounts ORDER BY created_at`;
    console.log(`Found ${accounts.length} accounts`);
    
    console.log('\nClearing local...');
    await local.$executeRaw`TRUNCATE bank_accounts RESTART IDENTITY CASCADE`;
    
    console.log('Copying to local...');
    for (const acc of accounts) {
      await local.$executeRaw`
        INSERT INTO bank_accounts (
          id, uuid, account_number, currency_uuid, is_active, created_at, updated_at, bank_uuid,
          balance, balance_date, parsing_scheme_uuid
        ) VALUES (
          ${acc.id}, ${acc.uuid}::uuid, ${acc.account_number}, ${acc.currency_uuid}::uuid,
          ${acc.is_active}, ${acc.created_at}, ${acc.updated_at}, ${acc.bank_uuid}::uuid,
          ${acc.balance}, ${acc.balance_date}, ${acc.parsing_scheme_uuid}::uuid
        )
      `;
    }
    
    console.log(`✓ Copied ${accounts.length} accounts`);
    
    const maxId = Math.max(...accounts.map(a => Number(a.id)));
    await local.$executeRaw`SELECT setval('bank_accounts_id_seq', ${maxId}, true)`;
    console.log(`✓ Reset sequence to ${maxId}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await supabase.$disconnect();
    await local.$disconnect();
  }
}

main();
