const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
// Find fcList construction
const idx = src.indexOf('fcList');
console.log('=== fcList ===');
console.log(src.slice(idx, idx + 800));
