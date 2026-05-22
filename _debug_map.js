const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find waybillFcMap computation and all references
const idx = src.indexOf('waybillFcMap = new Map');
console.log('=== waybillFcMap computation ===');
console.log(src.slice(idx, idx + 300));

// Check how the header row 1 uses waybillFcMap
const idx2 = src.indexOf('waybillFcMap.has(fc.uuid)');
let pos = 0;
let count = 0;
while ((pos = src.indexOf('waybillFcMap.has(fc.uuid)', pos)) !== -1) {
  count++;
  const line = src.slice(0, pos).split('\n').length;
  console.log(`\n--- waybillFcMap.has occurrence ${count} at line ${line} ---`);
  console.log(src.slice(Math.max(0, pos-80), pos+120));
  pos += 25;
}

// Check there is no remaining waybillFcSet reference
const remaining = src.indexOf('waybillFcSet');
console.log('\nRemaining waybillFcSet occurrences:', remaining !== -1 ? 'YES - found at line ' + src.slice(0,remaining).split('\n').length : 'none');
