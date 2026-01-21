const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

// API version (from route.ts)
function generatePaymentId_API(counteragentUuid, financialCodeUuid, salaryMonth) {
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

// Import version (from import_salary_accruals.js)
function generatePaymentId_IMPORT(counteragentUuid, financialCodeUuid, salaryMonth) {
  const extractChars = (uuid) => {
    const cleaned = uuid.replace(/-/g, "");
    return cleaned[1] + cleaned[3] + cleaned[5] + cleaned[7] + cleaned[9] + cleaned[11];
  };

  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);

  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

async function testPaymentIdConsistency() {
  console.log('🧪 Testing payment_id generation consistency\n');
  console.log('='.repeat(50));
  
  // Fetch a few records from salary_accruals
  const records = await prisma.$queryRaw`
    SELECT 
      id,
      counteragent_uuid,
      financial_code_uuid,
      salary_month,
      payment_id as stored_payment_id
    FROM salary_accruals
    WHERE payment_id IS NOT NULL
    LIMIT 10
  `;
  
  console.log(`\n📊 Testing ${records.length} records from database...\n`);
  
  let allMatch = true;
  let apiMatches = 0;
  let importMatches = 0;
  let mismatches = 0;
  
  for (const record of records) {
    const salaryDate = new Date(record.salary_month);
    
    const apiGenerated = generatePaymentId_API(
      record.counteragent_uuid,
      record.financial_code_uuid,
      salaryDate
    );
    
    const importGenerated = generatePaymentId_IMPORT(
      record.counteragent_uuid,
      record.financial_code_uuid,
      salaryDate
    );
    
    const apiMatch = apiGenerated === record.stored_payment_id;
    const importMatch = importGenerated === record.stored_payment_id;
    const algorithmsMatch = apiGenerated === importGenerated;
    
    if (apiMatch) apiMatches++;
    if (importMatch) importMatches++;
    if (!apiMatch || !importMatch) {
      allMatch = false;
      mismatches++;
      
      console.log(`❌ MISMATCH - Record ID: ${record.id}`);
      console.log(`   Stored:          ${record.stored_payment_id}`);
      console.log(`   API Generated:   ${apiGenerated} ${apiMatch ? '✅' : '❌'}`);
      console.log(`   Import Generated: ${importGenerated} ${importMatch ? '✅' : '❌'}`);
      console.log(`   Algorithms Match: ${algorithmsMatch ? '✅' : '❌'}`);
      console.log(`   Counteragent:    ${record.counteragent_uuid}`);
      console.log(`   Financial Code:  ${record.financial_code_uuid}`);
      console.log(`   Salary Month:    ${salaryDate.toISOString()}`);
      console.log('');
    }
  }
  
  console.log('='.repeat(50));
  console.log('\n📋 RESULTS:');
  console.log(`   Total tested:        ${records.length}`);
  console.log(`   API matches:         ${apiMatches} ${apiMatches === records.length ? '✅' : '❌'}`);
  console.log(`   Import matches:      ${importMatches} ${importMatches === records.length ? '✅' : '❌'}`);
  console.log(`   Mismatches:          ${mismatches}`);
  
  if (allMatch) {
    console.log('\n✅ ALL PAYMENT IDS MATCH! Algorithm is consistent.\n');
  } else {
    console.log('\n❌ FOUND INCONSISTENCIES! Algorithm may need fixing.\n');
  }
  
  // Now test with sample data
  console.log('='.repeat(50));
  console.log('\n🧪 Testing with sample UUIDs...\n');
  
  const testCases = [
    {
      name: 'Sample Employee A + Code X + Jan 2025',
      counteragent: '12345678-1234-5678-1234-567812345678',
      financial: '87654321-8765-4321-8765-432187654321',
      date: new Date('2025-01-15')
    },
    {
      name: 'Sample Employee B + Code Y + Nov 2024',
      counteragent: 'abcdef12-abcd-ef12-abcd-ef12abcdef12',
      financial: '11223344-1122-3344-1122-334411223344',
      date: new Date('2024-11-10')
    }
  ];
  
  for (const test of testCases) {
    const apiResult = generatePaymentId_API(test.counteragent, test.financial, test.date);
    const importResult = generatePaymentId_IMPORT(test.counteragent, test.financial, test.date);
    const match = apiResult === importResult;
    
    console.log(`Test: ${test.name}`);
    console.log(`   API:    ${apiResult}`);
    console.log(`   Import: ${importResult}`);
    console.log(`   Match:  ${match ? '✅' : '❌'}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

testPaymentIdConsistency().catch(console.error);
