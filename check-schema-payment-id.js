const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    // Check consolidated_bank_accounts columns
    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'consolidated_bank_accounts' 
      ORDER BY ordinal_position
    `;
    console.log('consolidated_bank_accounts columns:');
    console.log(JSON.stringify(cols, null, 2));

    // Check if there's a payment_id column
    const hasPaymentId = cols.some(c => c.column_name === 'payment_id');
    console.log('\nHas payment_id column:', hasPaymentId);

    // Check a few records to see what data is there
    const sample = await prisma.$queryRaw`
      SELECT uuid, counteragent_uuid, project_uuid, payment_id, nominal_amount, transaction_date
      FROM consolidated_bank_accounts
      WHERE payment_id IS NOT NULL
      LIMIT 5
    `;
    console.log('\nSample records with payment_id:');
    console.log(JSON.stringify(sample, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
