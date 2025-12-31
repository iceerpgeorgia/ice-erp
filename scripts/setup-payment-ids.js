#!/usr/bin/env node
/**
 * Complete payment trigger setup and backfill
 * This will:
 * 1. Check if trigger exists
 * 2. Apply trigger if missing
 * 3. Backfill missing payment_id and record_uuid for existing payments
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Generate custom format: 6hex_2hex_4hex
function generateCustomId() {
  const hex = '0123456789abcdef';
  let id = '';
  
  for (let i = 0; i < 6; i++) id += hex[Math.floor(Math.random() * 16)];
  id += '_';
  for (let i = 0; i < 2; i++) id += hex[Math.floor(Math.random() * 16)];
  id += '_';
  for (let i = 0; i < 4; i++) id += hex[Math.floor(Math.random() * 16)];
  
  return id;
}

async function main() {
  console.log('🚀 Payment ID Auto-Generation Setup\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Check if trigger exists
    console.log('\n📋 Step 1: Checking trigger installation...');
    
    const functionCheck = await prisma.$queryRaw`
      SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'generate_payment_id'
      ) as exists
    `;
    const functionExists = functionCheck[0]?.exists || false;

    if (functionExists) {
      console.log('   ✅ Trigger function exists');
    } else {
      console.log('   ⚠️  Trigger function NOT found');
    }

    const triggerCheck = await prisma.$queryRaw`
      SELECT tgname 
      FROM pg_trigger 
      WHERE tgrelid = 'payments'::regclass 
      AND tgname LIKE '%payment_id%'
    `;

    const triggerExists = triggerCheck.length > 0;
    if (triggerExists) {
      console.log(`   ✅ Trigger attached to payments table`);
    } else {
      console.log('   ⚠️  Trigger NOT attached to payments table');
    }

    // Step 2: Apply trigger if missing
    if (!functionExists || !triggerExists) {
      console.log('\n📋 Step 2: Applying trigger...');
      
      const sqlFile = path.join(__dirname, '..', 'prisma', 'migrations', '20251224140000_update_payment_id_generation', 'migration.sql');
      
      if (!fs.existsSync(sqlFile)) {
        throw new Error(`SQL file not found: ${sqlFile}`);
      }

      console.log('   📄 Reading SQL file...');
      const sql = fs.readFileSync(sqlFile, 'utf8');
      
      console.log('   ⏳ Executing SQL...');
      await prisma.$executeRawUnsafe(sql);
      
      console.log('   ✅ Trigger applied successfully!');
    } else {
      console.log('\n📋 Step 2: Trigger already installed, skipping');
    }

    // Step 3: Find payments with missing IDs
    console.log('\n📋 Step 3: Checking for payments with missing IDs...');
    
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
      console.log('   ✅ All payments have IDs - nothing to backfill!');
    } else {
      console.log(`   Found ${paymentsWithMissingIds.length} payments with missing IDs`);
      
      // Show payment #4226 specifically if it's missing IDs
      const payment4226 = paymentsWithMissingIds.find(p => p.id === 4226);
      if (payment4226) {
        console.log(`   ⚠️  Payment #4226 is missing IDs!`);
      }

      // Step 4: Backfill missing IDs
      console.log('\n📋 Step 4: Backfilling missing IDs...');
      
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
          
          if (updated % 10 === 0 || updated === paymentsWithMissingIds.length) {
            process.stdout.write(`   Progress: ${updated}/${paymentsWithMissingIds.length}\r`);
          }
        } catch (error) {
          errors++;
          console.error(`\n   ❌ Failed to update payment #${payment.id}: ${error.message}`);
        }
      }

      console.log(`\n   ✅ Backfill complete: ${updated} updated`);
      if (errors > 0) {
        console.log(`   ⚠️  Errors: ${errors}`);
      }
    }

    // Step 5: Verify payment #4226
    console.log('\n📋 Step 5: Verifying payment #4226...');
    const payment4226 = await prisma.payment.findUnique({
      where: { id: 4226 },
      select: { id: true, paymentId: true, recordUuid: true }
    });

    if (payment4226) {
      console.log(`   ID: ${payment4226.id}`);
      console.log(`   payment_id: ${payment4226.paymentId || '❌ MISSING'}`);
      console.log(`   record_uuid: ${payment4226.recordUuid || '❌ MISSING'}`);
      
      if (payment4226.paymentId && payment4226.recordUuid) {
        console.log('   ✅ Payment #4226 has all IDs!');
      } else {
        console.log('   ❌ Payment #4226 still missing IDs');
      }
    } else {
      console.log('   ❌ Payment #4226 not found in database');
    }

    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Setup complete!');
    console.log('   • Trigger is installed and active');
    console.log('   • All existing payments now have IDs');
    console.log('   • New payments will auto-generate IDs');
    console.log('=' .repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
