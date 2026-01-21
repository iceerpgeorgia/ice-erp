const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const uuid = '3d946a71-8857-4afa-b8c0-1562c3f13bda';
  
  // Query the raw table
  const rawRecord = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM bog_gel_raw_893486000
    WHERE uuid = '${uuid}'
  `);

  if (rawRecord.length === 0) {
    console.log('❌ Record not found in bog_gel_raw_893486000');
    return;
  }

  const record = rawRecord[0];
  console.log('\n📋 Raw Record Details:');
  console.log('UUID:', record.uuid);
  console.log('DocKey:', record.dockey);
  console.log('EntriesId:', record.entriesid);
  console.log('Transaction Date:', record.transactiondate);
  console.log('Debit:', record.debit);
  console.log('Credit:', record.credit);
  console.log('DocInformation:', record.docinformation);
  console.log('DocProdGroup:', record.docprodgroup);
  console.log('DocSenderInn:', record.docsenderinn);
  console.log('DocBenefInn:', record.docbenefinn);
  
  // Check if it was processed
  console.log('\n🔍 Processing Status:');
  console.log('counteragent_processed:', record.counteragent_processed);
  console.log('parsing_rule_processed:', record.parsing_rule_processed);
  console.log('payment_id_processed:', record.payment_id_processed);
  console.log('is_processed:', record.is_processed);
  
  // Check consolidated table
  const consolidated = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM consolidated_bank_accounts
    WHERE doc_key = '${record.dockey}' AND entries_id = '${record.entriesid}'
  `);

  if (consolidated.length > 0) {
    console.log('\n📊 Consolidated Record:');
    const cons = consolidated[0];
    console.log('payment_id:', cons.payment_id);
    console.log('counteragent_uuid:', cons.counteragent_uuid);
    console.log('project_uuid:', cons.project_uuid);
    
    // Check if this payment_id exists in salary_accruals
    if (cons.payment_id) {
      const salaryMatch = await prisma.salary_accruals.findFirst({
        where: { payment_id: cons.payment_id },
        select: {
          id: true,
          payment_id: true,
          counteragent_uuid: true,
          net_sum: true,
          salary_month: true,
        },
      });
      
      if (salaryMatch) {
        console.log('\n✅ MATCHED TO SALARY ACCRUAL:');
        console.log('Salary ID:', salaryMatch.id);
        console.log('Payment ID:', salaryMatch.payment_id);
        console.log('Net Sum:', salaryMatch.net_sum);
        console.log('Month:', salaryMatch.salary_month);
      } else {
        console.log('\n⚠️ payment_id not found in salary_accruals');
        
        // Try case-insensitive
        const salaryMatchCI = await prisma.$queryRawUnsafe(`
          SELECT id, payment_id, counteragent_uuid, net_sum, salary_month
          FROM salary_accruals
          WHERE LOWER(payment_id) = LOWER('${cons.payment_id}')
          LIMIT 1
        `);
        
        if (salaryMatchCI.length > 0) {
          console.log('\n✅ MATCHED TO SALARY (case-insensitive):');
          console.log('Salary ID:', salaryMatchCI[0].id);
          console.log('Payment ID:', salaryMatchCI[0].payment_id);
        }
      }
    }
  } else {
    console.log('\n❌ No consolidated record found for this transaction');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
