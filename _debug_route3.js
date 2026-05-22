const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// Show the full SQL around the waybill parts - specifically the CTE chain order
const idx = src.indexOf('WITH payment_currencies AS');
if (idx !== -1) {
  console.log('=== Main SQL start ===');
  console.log(src.slice(idx, idx + 400));
}

// Show around the GROUP BY / JOINs
const idx2 = src.indexOf('LEFT JOIN adj_agg adj');
if (idx2 !== -1) {
  console.log('\n=== JOINs section ===');
  console.log(src.slice(idx2, idx2 + 600));
}

// Show how rows are processed
const idx3 = src.indexOf('for (const row of rows)');
if (idx3 !== -1) {
  console.log('\n=== row processing ===');
  console.log(src.slice(idx3, idx3 + 600));
}
