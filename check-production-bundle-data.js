require('dotenv').config({ path: '.env.production.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkProductionData() {
  const projectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
  
  console.log('Connecting to PRODUCTION database...');
  console.log('Database:', process.env.DATABASE_URL?.split('@')[1]?.split('?')[0]);
  console.log();
  
  // Check if project exists
  const project = await prisma.$queryRawUnsafe(
    `SELECT project_uuid::text, project_name, financial_code_uuid::text 
     FROM projects 
     WHERE project_uuid = $1::uuid`,
    projectUuid
  );
  
  if (project.length === 0) {
    console.log('❌ Project NOT found in production database!');
    await prisma.$disconnect();
    return;
  }
  
  console.log('✅ Project found:', project[0].project_name);
  console.log('   Financial Code UUID:', project[0].financial_code_uuid);
  console.log();
  
  // Check bundle payments
  const payments = await prisma.$queryRawUnsafe(
    `SELECT payment_id, financial_code_uuid::text, is_bundle_payment
     FROM payments 
     WHERE project_uuid = $1::uuid AND is_bundle_payment = true`,
    projectUuid
  );
  
  console.log(`Found ${payments.length} bundle payments in PRODUCTION`);
  console.log();
  
  // Check ledger data for each payment
  for (const p of payments) {
    const ledger = await prisma.$queryRawUnsafe(
      `SELECT SUM("order") as total_order, MAX(effective_date) as latest_date
       FROM payments_ledger 
       WHERE payment_id = $1`,
      p.payment_id
    );
    console.log(`Payment ${p.payment_id}:`);
    console.log(`  Total Order: ${ledger[0]?.total_order || 0}`);
    console.log(`  Latest Date: ${ledger[0]?.latest_date || 'none'}`);
  }
  
  await prisma.$disconnect();
}

checkProductionData().catch(console.error);
