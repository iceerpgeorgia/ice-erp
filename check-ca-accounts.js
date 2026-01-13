const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkData() {
  try {
    // Count total records and records with counteragent account
    const result = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(counteragent_account_number) as with_account,
        COUNT(CASE WHEN counteragent_account_number IS NOT NULL THEN 1 END) as not_null_count
      FROM consolidated_bank_accounts
    `;
    
    console.log('\n📊 Counteragent Account Statistics:');
    console.log({
      total: Number(result[0].total),
      with_account: Number(result[0].with_account),
      not_null_count: Number(result[0].not_null_count)
    });
    
    // Get sample records with counteragent account
    const withAccount = await prisma.$queryRaw`
      SELECT 
        id,
        transaction_date,
        counteragent_account_number,
        description
      FROM consolidated_bank_accounts
      WHERE counteragent_account_number IS NOT NULL
      LIMIT 10
    `;
    
    console.log('\n✅ Sample records WITH counteragent account:');
    withAccount.forEach(r => console.log({
      id: Number(r.id),
      transaction_date: r.transaction_date,
      counteragent_account_number: r.counteragent_account_number,
      description: r.description?.substring(0, 50)
    }));
    
    // Get sample records without counteragent account
    const withoutAccount = await prisma.$queryRaw`
      SELECT 
        id,
        transaction_date,
        counteragent_account_number,
        description
      FROM consolidated_bank_accounts
      WHERE counteragent_account_number IS NULL
      LIMIT 5
    `;
    
    console.log('\n❌ Sample records WITHOUT counteragent account:');
    withoutAccount.forEach(r => console.log({
      id: Number(r.id),
      transaction_date: r.transaction_date,
      counteragent_account_number: r.counteragent_account_number,
      description: r.description?.substring(0, 50)
    }));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
