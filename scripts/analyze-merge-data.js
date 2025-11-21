const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const excelPath = path.join(process.cwd(), 'Merge Data Counteragents.xlsx');
console.log('📖 Reading Excel file:', excelPath);

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`\n📊 Total rows: ${data.length}`);
console.log('\n📋 First 5 rows:');
data.slice(0, 5).forEach((row, i) => {
  console.log(`\nRow ${i + 1}:`, JSON.stringify(row, null, 2));
});

console.log('\n📋 Column names:');
if (data.length > 0) {
  Object.keys(data[0]).forEach(key => {
    console.log(`   - ${key}`);
  });
}

console.log('\n📊 Data types check:');
if (data.length > 0) {
  const sample = data[0];
  Object.entries(sample).forEach(([key, value]) => {
    console.log(`   ${key}: ${typeof value} - ${value}`);
  });
}
