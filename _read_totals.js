const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Find the Totals row flatMap
const idx = src.indexOf('/* Totals row */');
console.log(JSON.stringify(src.slice(idx, idx + 1200)));
