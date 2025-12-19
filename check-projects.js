const XLSX = require('xlsx');

const wb = XLSX.readFile('Projects.xlsx');
console.log('Sheet names:', wb.SheetNames);

const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

console.log('\nTotal rows:', data.length);
console.log('\nHeaders:', Object.keys(data[0] || {}));

console.log('\nFirst 3 rows:');
data.slice(0, 3).forEach((row, i) => {
  console.log(`\n--- Row ${i+1} ---`);
  Object.entries(row).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });
});

console.log('\n\nValidation checks:');
let issues = [];

data.forEach((row, idx) => {
  const rowNum = idx + 2; // +2 for header and 1-based
  
  if (!row['Counteragent UUID'] || row['Counteragent UUID'].trim() === '') {
    issues.push(`Row ${rowNum}: Missing Counteragent UUID`);
  }
  
  if (!row['Project Name'] || row['Project Name'].trim() === '') {
    issues.push(`Row ${rowNum}: Missing Project Name`);
  }
  
  if (!row['Financial Code UUID'] || row['Financial Code UUID'].trim() === '') {
    issues.push(`Row ${rowNum}: Missing Financial Code UUID`);
  }
  
  if (!row['Date']) {
    issues.push(`Row ${rowNum}: Missing Date`);
  }
  
  if (!row['Value'] && row['Value'] !== 0) {
    issues.push(`Row ${rowNum}: Missing Value`);
  }
  
  if (!row['Currency UUID'] || row['Currency UUID'].trim() === '') {
    issues.push(`Row ${rowNum}: Missing Currency UUID`);
  }
  
  if (!row['State UUID'] || row['State UUID'].trim() === '') {
    issues.push(`Row ${rowNum}: Missing State UUID`);
  }
});

if (issues.length > 0) {
  console.log('\n❌ Issues found:');
  issues.forEach(issue => console.log(`  ${issue}`));
  console.log(`\nTotal issues: ${issues.length}`);
} else {
  console.log('✅ All required fields present!');
}

console.log(`\nReady to import: ${data.length} projects`);
