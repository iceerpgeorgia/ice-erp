const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(process.cwd(), 'public', 'handover template.xlsx');
console.log('Loading template from:', templatePath);

const templateBuffer = fs.readFileSync(templatePath);
const workbook = XLSX.read(templateBuffer, { cellFormula: true });

console.log('\n📋 Sheets in workbook:');
workbook.SheetNames.forEach((sheet, i) => {
  console.log(`  ${i + 1}. ${sheet}`);
});

console.log('\nWorkbook object:', {
  SheetNames: workbook.SheetNames,
  SheetCount: workbook.SheetNames.length,
});

// Test write
const testBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
const testWorkbook = XLSX.read(testBuffer);

console.log('\n📋 Sheets after write/read cycle:');
testWorkbook.SheetNames.forEach((sheet, i) => {
  console.log(`  ${i + 1}. ${sheet}`);
});
