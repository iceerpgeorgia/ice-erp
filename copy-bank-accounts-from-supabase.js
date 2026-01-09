const { PrismaClient } = require('@prisma/client');

async function copyData() {
  const supabasePrisma = new PrismaClient({
    datasources: { 
      db: { 
        url: 'postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1'
      } 
    }
  });
  
  const localPrisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP?schema=public' } }
  });

  try {
    console.log('Fetching data from Supabase...');
    const supabaseAccounts = await supabasePrisma.$queryRaw`
      SELECT * FROM bank_accounts ORDER BY created_at
    `;
    console.log(`Found ${supabaseAccounts.length} bank accounts in Supabase`);
    
    console.log('\nDisabling triggers and clearing local bank_accounts table...');
    await localPrisma.$executeRaw`ALTER TABLE consolidated_bank_accounts DISABLE TRIGGER ALL`;
    await localPrisma.$executeRaw`TRUNCATE bank_accounts CASCADE`;
    await localPrisma.$executeRaw`ALTER TABLE consolidated_bank_accounts ENABLE TRIGGER ALL`;
    
    console.log('Copying data to local...');
    for (const account of supabaseAccounts) {
      await localPrisma.$executeRaw`
        INSERT INTO bank_accounts (
          id, uuid, account_number, currency_uuid, is_active, 
          created_at, updated_at, bank_uuid, balance, balance_date, parsing_scheme_uuid
        ) VALUES (
          ${account.id}::bigint,
          ${account.uuid}::uuid,
          ${account.account_number},
          ${account.currency_uuid}::uuid,
          ${account.is_active},
          ${account.created_at}::timestamp,
          ${account.updated_at}::timestamp,
          ${account.bank_uuid}::uuid,
          ${account.balance}::numeric,
          ${account.balance_date}::date,
          ${account.parsing_scheme_uuid}::uuid
        )
      `;
    }
    
    console.log(`✓ Copied ${supabaseAccounts.length} bank accounts to local database`);
    
    // Update sequence
    if (supabaseAccounts.length > 0) {
      const maxId = Math.max(...supabaseAccounts.map(a => Number(a.id)));
      await localPrisma.$executeRaw`
        SELECT setval('bank_accounts_id_seq', ${maxId}, true)
      `;
      console.log(`✓ Updated sequence to ${maxId}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await supabasePrisma.$disconnect();
    await localPrisma.$disconnect();
  }
}

copyData();
