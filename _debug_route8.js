const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// Print lines 240-350 to see the full SQL context around waybill_agg insertion
for (let i = 239; i <= 349; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
