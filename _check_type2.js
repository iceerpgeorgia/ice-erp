const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');
// Find the cells type - specifically end of cells object type
const idx = src.indexOf('cells: {');
const snippet = src.slice(idx, idx + 1000);
console.log(snippet);
