const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');
// Check Step 1 - waybill_agg should be gone
console.log('waybill_agg CTE present:', src.includes('waybill_agg AS ('));
// Check Step 2 - waybill_sum in SELECT should be gone from main
console.log('MAX(wa.waybill_sum) gone:', !src.includes('MAX(wa.waybill_sum)'));
// Check Step 3 - fc_pair gone
console.log('fc_pair gone:', !src.includes('fc_pair ON'));
// Check Step 4 - waybillSum: 0 for payment rows
console.log('waybillSum: 0 present:', src.includes('waybillSum: 0,'));
// Check Step 5 - waybill query inserted
console.log('waybillRowQuery present:', src.includes('waybillRowQuery'));
console.log('waybillRows loop present:', src.includes('for (const wr of waybillRows)'));
// Show the inserted section
const idx = src.indexOf('// Waybill rows: separate cells');
console.log('\n--- Inserted section (first 800 chars) ---');
console.log(src.slice(idx, idx + 800));
