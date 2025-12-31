#!/usr/bin/env node
/**
 * Check payment trigger status and payment #4226
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTrigger() {
  try {
    console.log('🔌 Connecting to database...\n');

    // Check if trigger function exists
    console.log('1️⃣ Checking trigger function...');
    const functionCheck = await prisma.$queryRaw`
      SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'generate_payment_id'
      ) as exists
    `;
    const functionExists = functionCheck[0]?.exists || false;
    console.log(functionExists ? '   ✅ Function exists' : '   ❌ Function NOT FOUND');

    // Check if trigger is attached
    console.log('\n2️⃣ Checking trigger on payments table...');
    const triggerCheck = await prisma.$queryRaw`
      SELECT tgname, tgenabled 
      FROM pg_trigger 
      WHERE tgrelid = 'payments'::regclass 
      AND tgname LIKE '%payment_id%'
    `;
    
    if (triggerCheck.length > 0) {
      console.log(`   ✅ Found ${triggerCheck.length} trigger(s):`);
      triggerCheck.forEach(t => {
        const status = t.tgenabled === 'O' ? 'ENABLED' : 'DISABLED';
        console.log(`      - ${t.tgname} (${status})`);
      });
    } else {
      console.log('   ❌ No trigger found');
    }

    // Check payment #4226
    console.log('\n3️⃣ Checking payment #4226...');
    const payment = await prisma.payment.findUnique({
      where: { id: 4226 },
      select: { id: true, paymentId: true, recordUuid: true }
    });

    if (payment) {
      console.log(`   Payment #${payment.id}:`);
      console.log(`      payment_id: ${payment.paymentId || '❌ NULL/EMPTY'}`);
      console.log(`      record_uuid: ${payment.recordUuid || '❌ NULL/EMPTY'}`);
      
      if (!payment.paymentId || !payment.recordUuid) {
        console.log('\n   ⚠️ Missing IDs - trigger was not active when created');
      }
    } else {
      console.log('   ❌ Payment #4226 not found');
    }

    // Check last 5 payments
    console.log('\n4️⃣ Last 5 payments:');
    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { id: 'desc' },
      select: { id: true, paymentId: true, recordUuid: true }
    });

    recentPayments.forEach(p => {
      const pidStatus = p.paymentId ? '✅' : '❌';
      const uuidStatus = p.recordUuid ? '✅' : '❌';
      console.log(`   ID ${p.id}: payment_id=${p.paymentId || 'NULL'} ${pidStatus}, uuid=${p.recordUuid || 'NULL'} ${uuidStatus}`);
    });

    console.log('\n' + '='.repeat(60));
    if (!functionExists || triggerCheck.length === 0) {
      console.log('❌ TRIGGER NOT INSTALLED');
      console.log('   Run: pwsh scripts/apply-payment-trigger.ps1');
    } else {
      console.log('✅ TRIGGER IS ACTIVE');
      console.log('   New payments will auto-generate IDs');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkTrigger();
