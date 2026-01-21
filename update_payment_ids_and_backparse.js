#!/usr/bin/env node
/**
 * Update all salary_accruals records with correct payment IDs
 * Then truncate consolidated_bank_accounts and backparse
 */

const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const prisma = new PrismaClient();

// FIXED payment ID generation - extracts from UUID WITH hyphens
function generatePaymentId(counteragentUuid, financialCodeUuid, salaryMonth) {
  const extractChars = (uuid) => {
    // Excel MID works on UUID WITH hyphens at positions 2,4,6,8,10,12 (1-indexed)
    // = indices 1,3,5,7,9,11 (0-indexed)
    return uuid[1] + uuid[3] + uuid[5] + uuid[7] + uuid[9] + uuid[11];
  };

  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);

  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('SALARY ACCRUALS - UPDATE PAYMENT IDs & BACKPARSE');
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Fetch all salary accruals
    console.log('📊 Step 1: Fetching all salary accruals...');
    const accruals = await prisma.salary_accruals.findMany({
      select: {
        id: true,
        uuid: true,
        counteragent_uuid: true,
        financial_code_uuid: true,
        salary_month: true,
        payment_id: true,
      },
    });
    console.log(`   Found ${accruals.length} records\n`);

    // Step 2: Calculate correct payment IDs and prepare updates
    console.log('🔄 Step 2: Calculating correct payment IDs...');
    let updatedCount = 0;
    let unchangedCount = 0;
    const updates = [];

    for (const accrual of accruals) {
      const correctPaymentId = generatePaymentId(
        accrual.counteragent_uuid,
        accrual.financial_code_uuid,
        new Date(accrual.salary_month)
      );

      if (accrual.payment_id !== correctPaymentId) {
        updates.push({
          id: accrual.id,
          oldId: accrual.payment_id,
          newId: correctPaymentId,
        });
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }

    console.log(`   ✅ Correct: ${unchangedCount} records`);
    console.log(`   🔄 To update: ${updatedCount} records\n`);

    if (updatedCount > 0) {
      // Show first 5 examples
      console.log('   Examples of changes:');
      for (let i = 0; i < Math.min(5, updates.length); i++) {
        console.log(`     ${updates[i].oldId} → ${updates[i].newId}`);
      }
      if (updates.length > 5) {
        console.log(`     ... and ${updates.length - 5} more`);
      }
      console.log();

      // Step 3: Update payment IDs in bulk using raw SQL
      console.log('💾 Step 3: Updating payment IDs in bulk transaction...');
      
      // Build SQL for bulk update using CASE WHEN
      const sqlUpdates = updates.map((u) => 
        `WHEN id = ${u.id} THEN '${u.newId}'`
      ).join('\n        ');
      
      const updateSql = `
        UPDATE salary_accruals
        SET payment_id = CASE
        ${sqlUpdates}
        END
        WHERE id IN (${updates.map(u => u.id).join(',')})
      `;
      
      await prisma.$executeRawUnsafe(updateSql);
      console.log(`   ✅ Updated ${updates.length} records in single transaction`);
      console.log(`   ✅ All ${updatedCount} records updated!\n`);
    } else {
      console.log('   ℹ️  All payment IDs are already correct!\n');
    }

    // Step 4: Clear consolidated_bank_accounts (using DELETE for better performance)
    console.log('🗑️  Step 4: Clearing consolidated_bank_accounts...');
    const deleteResult = await prisma.$executeRawUnsafe(`DELETE FROM consolidated_bank_accounts`);
    console.log(`   ✅ Deleted ${deleteResult} records from consolidated table\n`);

    // Step 5: Get account UUID for backparse
    console.log('🔍 Step 5: Finding bank account for backparse...');
    const account = await prisma.bankAccount.findFirst({
      where: { accountNumber: '893486000' },
      select: { uuid: true, accountNumber: true },
    });

    if (!account) {
      console.log('   ⚠️  Account 893486000 not found, skipping backparse\n');
      return;
    }

    console.log(`   Found account: ${account.account_number} (${account.uuid})\n`);

    // Step 6: Run backparse
    console.log('🔄 Step 6: Running backparse with updated payment IDs...');
    console.log('   This will reprocess all raw bank data with the corrected payment IDs');
    console.log('   Please wait...\n');

    const { stdout, stderr } = await execPromise(
      `python import_bank_xml_data.py backparse --account-uuid ${account.uuid}`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );

    if (stdout) {
      // Show last 30 lines of output
      const lines = stdout.split('\n');
      const lastLines = lines.slice(-30).join('\n');
      console.log(lastLines);
    }

    if (stderr && !stderr.includes('DeprecationWarning')) {
      console.error('⚠️  Stderr:', stderr);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\nSummary:');
    console.log(`  • Updated ${updatedCount} payment IDs in salary_accruals`);
    console.log(`  • Cleared consolidated_bank_accounts table`);
    console.log(`  • Backparsed account ${account.account_number}`);
    console.log(`  • Payment IDs will now match correctly in bank transactions\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
