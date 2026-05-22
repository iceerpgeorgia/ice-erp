const fs = require('fs');
const src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');
// Print entire file
console.log(src);
