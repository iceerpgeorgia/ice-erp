const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// Show full cells.push block - more
const idx = src.indexOf('cells.push({');
console.log(src.slice(idx + 900, idx + 1400));
