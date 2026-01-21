// Test if database payment_ids match when regenerated from same inputs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generatePaymentId(counteragentUuid, financialCodeUuid, salaryMonth) {
  const extractChars = (uuid) => {
    const cleaned = uuid.replace(/-/g, '');
    return cleaned[1] + cleaned[3] + cleaned[5] + cleaned[7] + cleaned[9] + cleaned[11];
  };

  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);

  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TESTING DATABASE PAYMENT_ID CONSISTENCY');
  console.log('For each record: counteragent + financial + date → payment_id');
  console.log('='.repeat(70) + '\n');

  // Get all records from database
  const records = await prisma.salary_accruals.findMany({
    select: {
      id: true,
      payment_id: true,
      counteragent_uuid: true,
      financial_code_uuid: true,
      salary_month: true
    }
  });

  console.log(`📊 Testing ${records.length} records from database\n`);

  let matches = 0;
  let mismatches = 0;
  const mismatchExamples = [];

  for (const record of records) {
    const calculated = generatePaymentId(
      record.counteragent_uuid,
      record.financial_code_uuid,
      record.salary_month
    );

    if (record.payment_id === calculated) {
      matches++;
    } else {
      mismatches++;
      if (mismatchExamples.length < 10) {
        mismatchExamples.push({
          id: record.id,
          stored: record.payment_id,
          calculated: calculated,
          counteragent: record.counteragent_uuid,
          financial: record.financial_code_uuid,
          date: record.salary_month.toISOString().split('T')[0]
        });
      }
    }
  }

  console.log('📊 RESULTS:\n');
  console.log(`  ✅ Matches:    ${matches} (${((matches / records.length) * 100).toFixed(2)}%)`);
  console.log(`  ❌ Mismatches: ${mismatches} (${((mismatches / records.length) * 100).toFixed(2)}%)`);

  if (mismatches === 0) {
    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS! ALL DATABASE RECORDS ARE CONSISTENT!');
    console.log('   Same inputs (counteragent + financial + date) always produce');
    console.log('   the same payment_id that is stored in the database.');
    console.log('='.repeat(70) + '\n');
  } else {
    console.log('\n⚠️  MISMATCH EXAMPLES:\n');
    console.log('='.repeat(70));
    mismatchExamples.forEach(ex => {
      console.log(`Record ID: ${ex.id}`);
      console.log(`  Stored in DB: ${ex.stored}`);
      console.log(`  Calculated:   ${ex.calculated}`);
      console.log(`  Counteragent: ${ex.counteragent}`);
      console.log(`  Financial:    ${ex.financial}`);
      console.log(`  Date:         ${ex.date}`);
      console.log('');
    });
    console.log('='.repeat(70) + '\n');
  }

  // Test a specific example in detail
  console.log('🔍 DETAILED TEST - First Record:\n');
  const first = records[0];
  console.log(`  Database Record ID: ${first.id}`);
  console.log(`  Counteragent UUID:  ${first.counteragent_uuid}`);
  console.log(`  Financial UUID:     ${first.financial_code_uuid}`);
  console.log(`  Salary Month:       ${first.salary_month.toISOString().split('T')[0]}`);
  console.log('');
  
  const extractChars = (uuid) => {
    const cleaned = uuid.replace(/-/g, '');
    return cleaned[1] + cleaned[3] + cleaned[5] + cleaned[7] + cleaned[9] + cleaned[11];
  };
  
  const caPart = extractChars(first.counteragent_uuid);
  const fcPart = extractChars(first.financial_code_uuid);
  const month = first.salary_month.getMonth() + 1;
  const year = first.salary_month.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  
  console.log(`  Step 1 - Extract from counteragent: "${caPart}"`);
  console.log(`  Step 2 - Extract from financial:    "${fcPart}"`);
  console.log(`  Step 3 - Format date:                "${monthStr}${year}"`);
  console.log(`  Step 4 - Combine:                    "NP_${caPart}_NJ_${fcPart}_PRL${monthStr}${year}"`);
  console.log('');
  console.log(`  Stored in DB:    ${first.payment_id}`);
  console.log(`  Calculated:      ${generatePaymentId(first.counteragent_uuid, first.financial_code_uuid, first.salary_month)}`);
  console.log(`  Match: ${first.payment_id === generatePaymentId(first.counteragent_uuid, first.financial_code_uuid, first.salary_month) ? '✅ YES' : '❌ NO'}`);
  console.log('\n' + '='.repeat(70) + '\n');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
