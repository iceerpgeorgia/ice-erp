const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDates() {
  try {
    const raw = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as count, 
        MIN(created_at) as first, 
        MAX(created_at) as last 
      FROM bog_gel_raw_893486000
    `;
    
    console.log('Raw table:', {
      count: Number(raw[0].count),
      first: raw[0].first,
      last: raw[0].last
    });
    
    const cons = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as count, 
        MIN(created_at) as first, 
        MAX(created_at) as last 
      FROM consolidated_bank_accounts
    `;
    
    console.log('\nConsolidated table:', {
      count: Number(cons[0].count),
      first: cons[0].first,
      last: cons[0].last
    });
    
    // Check how many consolidated records link to raw records
    const linked = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM consolidated_bank_accounts
      WHERE raw_record_uuid IS NOT NULL
    `;
    
    console.log('\nConsolidated records linked to raw:', Number(linked[0].count));
    
    // Check for any consolidated records created recently
    const recent = await prisma.$queryRaw`
      SELECT id, transaction_date, description, counteragent_account_number, created_at
      FROM consolidated_bank_accounts
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log('\nMost recent consolidated records:');
    recent.forEach(r => console.log({
      id: Number(r.id),
      date: r.transaction_date,
      ca_account: r.counteragent_account_number,
      created: r.created_at
    }));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDates();
