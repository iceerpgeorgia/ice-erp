const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

// CURRENT/CORRECT algorithm (from API and Import)
function generatePaymentId(counteragentUuid, financialCodeUuid, salaryMonth) {
  const extractChars = (uuid) => {
    const cleaned = uuid.replace(/-/g, '');
    // Extract characters at positions 2, 4, 6, 8, 10, 12 (1-indexed = indices 1,3,5,7,9,11)
    return cleaned[1] + cleaned[3] + cleaned[5] + cleaned[7] + cleaned[9] + cleaned[11];
  };

  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);

  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

async function regenerateAllPaymentIds() {
  console.log('🔧 Regenerating ALL payment_ids in salary_accruals table...\n');
  console.log('='.repeat(60));
  
  // Fetch ALL records
  const records = await prisma.$queryRaw`
    SELECT 
      id,
      counteragent_uuid,
      financial_code_uuid,
      salary_month,
      payment_id as old_payment_id
    FROM salary_accruals
    ORDER BY id
  `;
  
  console.log(`\n📊 Found ${records.length} records to process\n`);
  
  let updated = 0;
  let unchanged = 0;
  let errors = 0;
  
  for (const record of records) {
    try {
      const salaryDate = new Date(record.salary_month);
      
      const newPaymentId = generatePaymentId(
        record.counteragent_uuid,
        record.financial_code_uuid,
        salaryDate
      );
      
      if (newPaymentId !== record.old_payment_id) {
        // Update the record
        await prisma.$executeRaw`
          UPDATE salary_accruals 
          SET payment_id = ${newPaymentId}
          WHERE id = ${record.id}
        `;
        
        updated++;
        
        if (updated <= 10) {
          console.log(`✏️  Updated ID ${record.id}:`);
          console.log(`   Old: ${record.old_payment_id}`);
          console.log(`   New: ${newPaymentId}`);
          console.log('');
        } else if (updated === 11) {
          console.log(`... (showing first 10, continuing update)\n`);
        }
      } else {
        unchanged++;
      }
      
      // Progress indicator every 100 records
      if ((updated + unchanged) % 100 === 0) {
        process.stdout.write(`\r📈 Progress: ${updated + unchanged}/${records.length} (${updated} updated, ${unchanged} unchanged)`);
      }
      
    } catch (error) {
      errors++;
      console.error(`\n❌ Error updating record ${record.id}:`, error.message);
    }
  }
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('\n📋 SUMMARY:');
  console.log(`   Total records:    ${records.length}`);
  console.log(`   Updated:          ${updated} ✅`);
  console.log(`   Unchanged:        ${unchanged}`);
  console.log(`   Errors:           ${errors} ${errors > 0 ? '❌' : ''}`);
  
  if (updated > 0) {
    console.log(`\n✅ Successfully regenerated ${updated} payment_ids!\n`);
    console.log('⚠️  IMPORTANT: Now run backparse to match these updated payment_ids:');
    console.log('   python import_bank_xml_data.py backparse --clear\n');
  } else {
    console.log('\n✅ All payment_ids already match current algorithm.\n');
  }
  
  await prisma.$disconnect();
}

regenerateAllPaymentIds().catch(console.error);
