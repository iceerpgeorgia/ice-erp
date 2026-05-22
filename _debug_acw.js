const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Show the autoColWidthsMap useMemo (the buildPivot call at line ~1423)
const idx = src.indexOf('const autoColWidthsMap = useMemo(');
console.log('=== autoColWidthsMap useMemo ===');
console.log(src.slice(idx, idx + 1500));
