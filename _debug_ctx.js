const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');
// Show lines 1415-1465 to understand the line 1423 context
for (let i = 1414; i <= 1464; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
