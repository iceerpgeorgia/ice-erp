const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyImportedRecord() {
  try {
    console.log('🔍 Verifying imported bank transaction record...\n');
    
    // Query the bank table for our imported record
    const record = await prisma.$queryRawUnsafe(`
      SELECT 
        uuid,
        transaction_date,
        account_currency_amount,
        nominal_amount,
        counteragent_uuid,
        payment_id,
        created_at
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE uuid = 'f243840c-190d-4f9d-a3b3-cb235bb9469e'
      LIMIT 1
    `);
    
    if (record && record.length > 0) {
      console.log('✅ RECORD FOUND IN DATABASE\n');
      console.log('━'.repeat(70));
      console.log('Transaction UUID:', record[0].uuid);
      console.log('Transaction Date:', record[0].transaction_date);
      console.log('Amount (GEL):', record[0].account_currency_amount);
      console.log('Nominal Amount:', record[0].nominal_amount);
      console.log('Counteragent UUID:', record[0].counteragent_uuid);
      console.log('Payment ID:', record[0].payment_id);
      console.log('Created At:', record[0].created_at);
      console.log('━'.repeat(70));
      console.log('\n✓ Data persistence verified - record is safely stored');
    } else {
      console.log('❌ Record not found - may not have been imported yet');
    }
    
  } catch (error) {
    console.error('❌ DATABASE QUERY FAILED\n');
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyImportedRecord();
