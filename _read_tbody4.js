const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Continue reading the flatMap block - show the closing section
const idx = 115418;
console.log(JSON.stringify(src.slice(idx + 2400, idx + 4200)));
