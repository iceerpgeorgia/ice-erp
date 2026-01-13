const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.$queryRaw`
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'consolidated_bank_accounts' 
      AND column_name = 'counteragent_account_number'
    `;
    
    console.log('Column type:', result[0]);
    
    // Check a few sample values
    const samples = await prisma.$queryRaw`
      SELECT 
        id,
        counteragent_account_number
      FROM consolidated_bank_accounts 
      WHERE counteragent_account_number IS NOT NULL 
      LIMIT 5
    `;
    
    console.log('\nSample values:');
    samples.forEach(s => {
      console.log({
        id: Number(s.id),
        value: s.counteragent_account_number,
        jsType: typeof s.counteragent_account_number,
        length: s.counteragent_account_number?.length
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
