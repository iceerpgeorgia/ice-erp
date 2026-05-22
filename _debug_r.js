const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// Show fc_pair join and SELECT
const idx = src.indexOf('LEFT JOIN (\n        SELECT uuid::text AS fc_uuid');
console.log('=== fc_pair join area ===');
console.log(src.slice(idx, idx + 500));

// Show SELECT list around waybill_sum
const idx2 = src.indexOf('COALESCE(MAX(wa.waybill_sum)');
console.log('\n=== SELECT area around waybill_sum ===');
console.log(src.slice(idx2 - 100, idx2 + 120));

// Show cells.push for pairedFcCode
const idx3 = src.indexOf('waybillSum: Number(row.waybill_sum');
console.log('\n=== cells.push waybillSum line ===');
console.log(src.slice(idx3 - 50, idx3 + 80));
