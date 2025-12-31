#!/usr/bin/env node
/**
 * Backfill missing payment_id and record_uuid for existing payments
 * Run this after applying the trigger to fix payments created without IDs
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Generate custom format: 6hex_2hex_4hex (e.g., "a1b2c3_4d_5e6f")
function generateCustomId() {
  const hex = '0123456789abcdef';
  let id = '';
  
  // 6 hex chars
  for (let i = 0; i < 6; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  id += '_';
  
  // 2 hex chars
  for (let i = 0; i < 2; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  id += '_';
  
  // 4 hex chars
  for (let i = 0; i < 4; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  
  return id;
}

async function backfillPaymentIds() {
  try {
    console.log('🔧 Backfilling missing payment IDs...\n');

    // Find payments with missing payment_id or record_uuid
    console.log('📊 Finding payments with missing IDs...');
    const paymentsWithMissingIds = await prisma.payment.findMany({
      where: {
        OR: [
          { paymentId: { equals: null } },
          { paymentId: { equals: '' } },
          { recordUuid: { equals: null } },
          { recordUuid: { equals: '' } }
        ]
      },
      select: { id: true, paymentId: true, recordUuid: true },
      orderBy: { id: 'asc' }
    });

    if (paymentsWithMissingIds.length === 0) {
      console.log('✅ All payments have IDs - nothing to backfill!\n');
      return;
    }

    console.log(`   Found ${paymentsWithMissingIds.length} payments with missing IDs:\n`);
    
    // Show first few as preview
    const preview = paymentsWithMissingIds.slice(0, 5);
    preview.forEach(p => {
      console.log(`   ID ${p.id}: payment_id=${p.paymentId || 'NULL'}, record_uuid=${p.recordUuid || 'NULL'}`);
    });
    if (paymentsWithMissingIds.length > 5) {
      console.log(`   ... and ${paymentsWithMissingIds.length - 5} more\n`);
    }

    console.log('\n🔄 Generating and updating IDs...');
    let updated = 0;
    let errors = 0;

    for (const payment of paymentsWithMissingIds) {
      try {
        const updateData = {};
        
        if (!payment.paymentId) {
          updateData.paymentId = generateCustomId();
        }
        
        if (!payment.recordUuid) {
          updateData.recordUuid = generateCustomId();
        }

        await prisma.payment.update({
          where: { id: payment.id },
          data: updateData
        });

        updated++;
        
        if (updated % 10 === 0) {
          process.stdout.write(`   Updated ${updated}/${paymentsWithMissingIds.length}...\r`);
        }
      } catch (error) {
        errors++;
        console.error(`\n   ❌ Failed to update payment #${payment.id}: ${error.message}`);
      }
    }

    console.log(`\n\n✅ Backfill complete!`);
    console.log(`   Successfully updated: ${updated}`);
    if (errors > 0) {
      console.log(`   Errors: ${errors}`);
    }

    // Verify payment #4226 specifically
    console.log('\n🔍 Verifying payment #4226...');
    const payment4226 = await prisma.payment.findUnique({
      where: { id: 4226 },
      select: { id: true, paymentId: true, recordUuid: true }
    });

    if (payment4226) {
      console.log(`   ID: ${payment4226.id}`);
      console.log(`   payment_id: ${payment4226.paymentId || '❌ STILL MISSING'}`);
      console.log(`   record_uuid: ${payment4226.recordUuid || '❌ STILL MISSING'}`);
      
      if (payment4226.paymentId && payment4226.recordUuid) {
        console.log('   ✅ Payment #4226 now has IDs!');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backfillPaymentIds();
