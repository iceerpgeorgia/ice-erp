const fs = require('fs');
const src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');
const idx = src.indexOf('const autoColWidthsMap = useMemo(');
console.log(src.slice(idx + 2700, idx + 3400));
