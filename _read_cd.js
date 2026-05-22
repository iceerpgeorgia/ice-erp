const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find CellData type - specifically the waybillSum line
const idx = src.indexOf('waybillSum: number;');
console.log('=== CellData waybillSum ===');
console.log(src.slice(idx - 50, idx + 100));

// Find the waybillFcSet computation
const idx2 = src.indexOf('const waybillFcSet = new Set<string>');
console.log('\n=== waybillFcSet computation ===');
console.log(src.slice(idx2, idx2 + 220));
