const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');
// Find the cells array type definition in route.ts
const idx = src.indexOf('cells: ');
console.log('=== cells array definition ===');
console.log(src.slice(Math.max(0,idx-100), idx + 500));
