// Verification script for bundle distribution payments_ledger creation
// Run with: node verify-bundle-ledger.js
// Checks that bundle payments now have ledger entries with distribution amounts

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyBundleLedger() {
  try {
    console.log('\n=== Bundle Distribution Ledger Verification ===\n');

    // Get all bundle payments with their ledger entries
    const bundlePayments = await prisma.$queryRawUnsafe(`
      SELECT 
        p.id,
        p.payment_id,
        p.project_uuid,
        fc.code as fc_code,
        fc.name as fc_name,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM payments_ledger WHERE payment_id = p.payment_id) as ledger_count,
        (SELECT COALESCE(SUM(accrual), 0) FROM payments_ledger WHERE payment_id = p.payment_id) as total_accrual,
        (SELECT COALESCE(SUM("order"), 0) FROM payments_ledger WHERE payment_id = p.payment_id) as total_order
      FROM payments p
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      WHERE p.is_bundle_payment = true
      ORDER BY p.created_at DESC
    `);

    console.log(`Total bundle payments: ${bundlePayments.length}\n`);

    if (bundlePayments.length === 0) {
      console.log('No bundle payments found in database.');
      return;
    }

    // Check for test project
    const testProjectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
    const testProjectPayments = bundlePayments.filter(p => p.project_uuid === testProjectUuid);
    
    if (testProjectPayments.length > 0) {
      console.log(`=== Test Project (${testProjectUuid}) ===\n`);
      for (const payment of testProjectPayments) {
        console.log(`${payment.fc_code} - ${payment.fc_name}`);
        console.log(`  Payment ID: ${payment.payment_id}`);
        console.log(`  Ledger Entries: ${payment.ledger_count}`);
        console.log(`  Total Accrual: ${payment.total_accrual}`);
        console.log(`  Total Order (Distribution): ${payment.total_order}`);
        console.log(`  Updated: ${payment.updated_at}\n`);
      }
    }

    // Show summary statistics
    const withLedger = bundlePayments.filter(p => p.ledger_count > 0);
    const withoutLedger = bundlePayments.filter(p => p.ledger_count === 0);
    
    console.log('=== Summary ===');
    console.log(`✅ Bundle payments WITH ledger entries: ${withLedger.length}`);
    console.log(`⚠️  Bundle payments WITHOUT ledger entries: ${withoutLedger.length}\n`);

    // Show detailed ledger entries for recent distributions
    if (withLedger.length > 0) {
      console.log('=== Recent Ledger Entries ===\n');
      
      const recentLedgers = await prisma.$queryRawUnsafe(`
        SELECT 
          pl.id,
          pl.payment_id,
          fc.code as fc_code,
          fc.name as fc_name,
          pl.effective_date,
          pl.accrual,
          pl."order" as distribution_amount,
          pl.comment,
          pl.user_email,
          pl.created_at
        FROM payments_ledger pl
        JOIN payments p ON pl.payment_id = p.payment_id
        LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
        WHERE p.is_bundle_payment = true
        ORDER BY pl.created_at DESC
        LIMIT 10
      `);

      for (const ledger of recentLedgers) {
        console.log(`FC: ${ledger.fc_code} - ${ledger.fc_name}`);
        console.log(`  Payment ID: ${ledger.payment_id}`);
        console.log(`  Distribution Amount: ${ledger.distribution_amount}`);
        console.log(`  Effective Date: ${ledger.effective_date}`);
        console.log(`  Comment: ${ledger.comment}`);
        console.log(`  Created by: ${ledger.user_email}`);
        console.log(`  Created at: ${ledger.created_at}\n`);
      }
    }

    // Check for any duplicate ledger entries
    const duplicateCheck = await prisma.$queryRawUnsafe(`
      SELECT 
        payment_id,
        effective_date,
        COUNT(*) as entry_count
      FROM payments_ledger
      WHERE payment_id IN (
        SELECT payment_id FROM payments WHERE is_bundle_payment = true
      )
      GROUP BY payment_id, effective_date
      HAVING COUNT(*) > 1
    `);

    if (duplicateCheck.length > 0) {
      console.log('⚠️  WARNING: Duplicate ledger entries detected:');
      console.log(duplicateCheck);
    } else {
      console.log('✅ No duplicate ledger entries found.');
    }

    console.log('\n=== Verification Complete ===\n');

  } catch (error) {
    console.error('Error verifying bundle ledger:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyBundleLedger();
