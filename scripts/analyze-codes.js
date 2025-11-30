// Quick script to count codes with GUIDs
const XLSX = require('xlsx');

const workbook = XLSX.readFile('Financial Codes Concept.xlsx');
const worksheet = workbook.Sheets['Codes'];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('\nAnalyzing Financial Codes...\n');

let totalRows = 0;
let codesWithGuid = 0;
let codesWithoutGuid = 0;

const guidPattern = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

console.log('Sample of first 20 codes:');
console.log('Code\t\tGUID Status\t\tType');
console.log('='.repeat(70));

data.forEach((row, index) => {
  if (!row.Code || row.Code === 'Code') return;
  
  totalRows++;
  const guid = row['Code_GUID/'];
  const hasValidGuid = guid && guidPattern.test(guid);
  
  if (hasValidGuid) {
    codesWithGuid++;
  } else {
    codesWithoutGuid++;
  }
  
  // Show first 20
  if (index < 20) {
    const status = hasValidGuid ? 'HAS GUID ✓' : 'NO GUID ✗';
    const type = row['IS Group/Formula'] || '';
    console.log(`${row.Code}\t${status}\t\t${type}`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('\n=== SUMMARY ===');
console.log(`Total rows with codes: ${totalRows}`);
console.log(`Codes WITH GUID: ${codesWithGuid} ✓`);
console.log(`Codes WITHOUT GUID: ${codesWithoutGuid}`);
console.log('\n=== BREAKDOWN BY TYPE ===');

// Breakdown by type
const breakdown = {};
data.forEach(row => {
  if (!row.Code || row.Code === 'Code') return;
  const guid = row['Code_GUID/'];
  const hasValidGuid = guid && guidPattern.test(guid);
  const type = row['IS Group/Formula'] || 'Unknown';
  
  if (!breakdown[type]) {
    breakdown[type] = { withGuid: 0, withoutGuid: 0 };
  }
  
  if (hasValidGuid) {
    breakdown[type].withGuid++;
  } else {
    breakdown[type].withoutGuid++;
  }
});

Object.entries(breakdown).forEach(([type, counts]) => {
  console.log(`${type}:`);
  console.log(`  With GUID: ${counts.withGuid}`);
  console.log(`  Without GUID: ${counts.withoutGuid}`);
});
