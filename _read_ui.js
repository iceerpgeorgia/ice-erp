const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// buildPivot function
const idx = src.indexOf('function buildPivot');
console.log('=== buildPivot ===');
console.log(src.slice(idx, idx + 1200));
