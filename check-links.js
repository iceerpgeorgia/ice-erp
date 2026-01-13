const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLinks() {
  try {
    const match = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM consolidated_bank_accounts cba 
      JOIN bog_gel_raw_893486000 raw ON cba.raw_record_uuid = raw.uuid
    `;
    
    console.log('Consolidated records linking to existing raw records:', Number(match[0].count));
    console.log('Orphaned consolidated records:', 49580 - Number(match[0].count));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLinks();
