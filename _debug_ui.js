const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Read full buildPivot to see cell merging
const idx = src.indexOf('function buildPivot');
console.log(src.slice(idx, idx + 3000));
