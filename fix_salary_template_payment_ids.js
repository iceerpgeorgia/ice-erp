const XLSX = require('xlsx');

console.log('Fixing payment_ids in salary_accruals template...\n');

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

console.log(`Processing ${data.length} records...\n`);

let fixed = 0;

// Fix each payment_id
for (const row of data) {
  const counteragentUuid = row.counteragent_uuid;
  const financialCodeUuid = row.financial_code_uuid;
  
  // Convert Excel serial date to JS Date if needed
  let salaryMonth;
  if (typeof row.salary_month === 'number') {
    salaryMonth = excelDateToJSDate(row.salary_month);
  } else {
    salaryMonth = new Date(row.salary_month);
  }
  
  // Extract first 6 hex characters from UUIDs (remove dashes, lowercase)
  const counteragentPart = counteragentUuid.replace(/-/g, '').toLowerCase().substring(0, 6);
  const finCodePart = financialCodeUuid.replace(/-/g, '').toLowerCase().substring(0, 6);
  
  // Format date as MMYYYY
  const month = String(salaryMonth.getMonth() + 1).padStart(2, '0');
  const year = String(salaryMonth.getFullYear());
  const datepart = month + year;
  
  // Generate correct payment_id
  const correctPaymentId = `NP_${counteragentPart}_NJ_${finCodePart}_PRL${datepart}`;
  
  // Update if different
  if (row.payment_id !== correctPaymentId) {
    row.payment_id = correctPaymentId;
    fixed++;
    
    if (fixed <= 5) {
      console.log(`Fixed payment_id:`);
      console.log(`  Old: ${row.payment_id || '(none)'}`);
      console.log(`  New: ${correctPaymentId}`);
      console.log(`  Date: ${salaryMonth.toISOString().split('T')[0]} (${month}/${year})`);
      console.log();
    }
  }
}

console.log(`\n${fixed} payment_ids fixed.\n`);

// Write back to file
const newSheet = XLSX.utils.json_to_sheet(data);
const newWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Salary Accruals');
XLSX.writeFile(newWorkbook, 'templates/salary_accruals_import_template.xlsx');

console.log('✅ Template updated successfully!\n');
