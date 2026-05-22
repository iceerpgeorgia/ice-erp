const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find cell value rendering in tbody - search for getCellValue
const idx = src.indexOf('getCellValue');
console.log('=== getCellValue (first occurrence context) ===');
console.log(src.slice(idx, idx + 300));

// find all occurrences of getCellValue
let pos = 0; let count = 0;
while ((pos = src.indexOf('getCellValue', pos)) !== -1) {
  count++;
  console.log('\n--- occurrence', count, '(line ~', src.slice(0,pos).split('\n').length, ') ---');
  console.log(src.slice(Math.max(0,pos-100), pos+200).replace(/\n/g,'↵'));
  pos += 12;
  if (count > 10) break;
}
