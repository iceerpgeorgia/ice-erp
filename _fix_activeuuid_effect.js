const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8').replace(/\r\n/g, '\n');

// Step 1: remove early useEffect that references activeViewUuid before its declaration
const BAD = [
  '  useEffect(() => {\n',
  '    if (activeViewUuid && typeof window !== \'undefined\') {\n',
  '      localStorage.setItem(\'projectsReportActiveView\', activeViewUuid);\n',
  '    }\n',
  '  }, [activeViewUuid]);\n',
  '\n',
  '  useEffect(() => {\n',
  '    if (typeof window !== \'undefined\' && localStorage.getItem(\'projectsReportTaxMult\') === \'true\') {\n',
].join('');

const REPLACEMENT_1 = [
  '  useEffect(() => {\n',
  '    if (typeof window !== \'undefined\' && localStorage.getItem(\'projectsReportTaxMult\') === \'true\') {\n',
].join('');

const c1 = src.split(BAD).length - 1;
if (c1 !== 1) { console.error('Step 1 BAD count:', c1); process.exit(1); }
src = src.replace(BAD, REPLACEMENT_1);
console.log('  Step 1 done: removed early activeViewUuid effect');

// Step 2: insert after viewsDropdownOpen state declaration
const ANCHOR = "  const [viewsDropdownOpen, setViewsDropdownOpen] = useState(false);";
const INSERT = "\n  // Persist last selected view UUID to localStorage\n  useEffect(() => {\n    if (activeViewUuid && typeof window !== 'undefined') {\n      localStorage.setItem('projectsReportActiveView', activeViewUuid);\n    }\n  }, [activeViewUuid]);";

const c2 = src.split(ANCHOR).length - 1;
if (c2 !== 1) { console.error('Step 2 ANCHOR count:', c2); process.exit(1); }
src = src.replace(ANCHOR, ANCHOR + INSERT);
console.log('  Step 2 done: inserted activeViewUuid effect after declaration');

fs.writeFileSync('components/figma/projects-report-table.tsx', src, 'utf8');
console.log('Done');
