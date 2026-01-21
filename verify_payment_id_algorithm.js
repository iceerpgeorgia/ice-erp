const XLSX = require('xlsx');

console.log('Verifying payment_id algorithm in salary_accruals template...\n');

// Helper function to convert Excel serial date to JavaScript Date
function excelDateToJSDate(serial) {
  if (typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

// Read template
const workbook = XLSX.readFile('templates/salary_accruals_import_template.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`Total records: ${data.length}\n`);

// Check first 5 records
const sample = data.slice(0, 5);

for (const row of sample) {
  const paymentId = row.payment_id;
  const counteragentUuid = row.counteragent_uuid.replace(/-/g, '').toLowerCase();
  const financialCodeUuid = row.financial_code_uuid.replace(/-/g, '').toLowerCase();
  
  // Convert Excel serial date to JS Date if needed
  let salaryMonth;
  if (typeof row.salary_month === 'number') {
    salaryMonth = excelDateToJSDate(row.salary_month);
  } else {
    salaryMonth = new Date(row.salary_month);
  }
  
  // Extract parts from payment_id
  const match = paymentId.match(/^NP_([a-f0-9]{6})_NJ_([a-f0-9]{6})_PRL(\d{2})(\d{4})$/);
  
  if (!match) {
    console.log(`❌ INVALID FORMAT: ${paymentId}`);
    continue;
  }
  
  const [_, counteragentPart, finCodePart, month, year] = match;
  
  // Expected values
  const expectedCounterpart = counteragentUuid.slice(0, 6);
  const expectedFinCodePart = financialCodeUuid.slice(0, 6);
  const expectedMonth = String(salaryMonth.getMonth() + 1).padStart(2, '0');
  const expectedYear = salaryMonth.getFullYear();
  
  console.log(`Payment ID: ${paymentId}`);
  console.log(`  Counteragent: ${counteragentPart} (expected: ${expectedCounterpart}) ${counteragentPart === expectedCounterpart ? '✅' : '❌'}`);
  console.log(`  Fin Code: ${finCodePart} (expected: ${expectedFinCodePart}) ${finCodePart === expectedFinCodePart ? '✅' : '❌'}`);
  console.log(`  Month: ${month} (expected: ${expectedMonth}) ${month === expectedMonth ? '✅' : '❌'}`);
  console.log(`  Year: ${year} (expected: ${expectedYear}) ${year == expectedYear ? '✅' : '❌'}`);
  console.log();
}

// Verify all records
let valid = 0;
let invalid = 0;

for (const row of data) {
  const paymentId = row.payment_id;
  const counteragentUuid = row.counteragent_uuid.replace(/-/g, '').toLowerCase();
  const financialCodeUuid = row.financial_code_uuid.replace(/-/g, '').toLowerCase();
  
  // Convert Excel serial date to JS Date if needed
  let salaryMonth;
  if (typeof row.salary_month === 'number') {
    salaryMonth = excelDateToJSDate(row.salary_month);
  } else {
    salaryMonth = new Date(row.salary_month);
  }
  
  const match = paymentId.match(/^NP_([a-f0-9]{6})_NJ_([a-f0-9]{6})_PRL(\d{2})(\d{4})$/);
  
  if (!match) {
    invalid++;
    continue;
  }
  
  const [_, counteragentPart, finCodePart, month, year] = match;
  const expectedCounterpart = counteragentUuid.slice(0, 6);
  const expectedFinCodePart = financialCodeUuid.slice(0, 6);
  const expectedMonth = String(salaryMonth.getMonth() + 1).padStart(2, '0');
  const expectedYear = salaryMonth.getFullYear();
  
  if (counteragentPart === expectedCounterpart && 
      finCodePart === expectedFinCodePart &&
      month === expectedMonth &&
      year == expectedYear) {
    valid++;
  } else {
    invalid++;
    console.log(`\n❌ MISMATCH in ${paymentId}`);
    console.log(`  UUID: ${row.counteragent_uuid}`);
    console.log(`  Fin Code: ${row.financial_code_uuid}`);
    console.log(`  Month: ${row.salary_month}`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`VALIDATION SUMMARY:`);
console.log(`  ✅ Valid: ${valid}`);
console.log(`  ❌ Invalid: ${invalid}`);
console.log(`${'='.repeat(60)}`);

if (valid === data.length) {
  console.log('\n✅✅✅ ALL PAYMENT IDs FOLLOW THE CORRECT ALGORITHM! ✅✅✅\n');
} else {
  console.log('\n❌ SOME PAYMENT IDs DO NOT MATCH THE ALGORITHM\n');
}
