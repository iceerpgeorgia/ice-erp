const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Get the full fcList.flatMap block that renders tds
const idx = 115418;
// Print from fcList.flatMap to find end
console.log(JSON.stringify(src.slice(idx, idx + 2500)));
