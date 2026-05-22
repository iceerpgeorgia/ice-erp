const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find fcSource construction
const idx = src.indexOf('fcSource');
console.log('=== fcSource (first 1200 chars) ===');
console.log(src.slice(idx, idx + 1200));
