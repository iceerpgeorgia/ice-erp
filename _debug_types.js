const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find ProjectData type
const idx = src.indexOf('type ProjectData = {');
console.log('=== ProjectData type ===');
console.log(src.slice(idx, idx + 1000));

// Confirm CellData type
const idx2 = src.indexOf('type CellData = {');
console.log('\n=== CellData type ===');
console.log(src.slice(idx2, idx2 + 600));
