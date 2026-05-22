const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Get more of the totals row flatMap
const idx = src.indexOf('/* Totals row */');
console.log(JSON.stringify(src.slice(idx + 1100, idx + 2000)));
