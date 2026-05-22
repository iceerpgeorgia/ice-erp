const fs = require('fs');
let src = fs.readFileSync('docs/DEPLOYMENT_LOG.md', 'utf8').replace(/\r\n/g, '\n');
const ANCHOR = '## 2026-05-14 Deployment #278';
const c = src.split(ANCHOR).length - 1;
if (c !== 1) { console.error('Anchor count:', c); process.exit(1); }
const NEW_ENTRY = [
  '## 2026-06-13 Deployment #279',
  '- Commit: 03fa8bd',
  '- Production: https://ice-laxrdi0bh-iceerp.vercel.app',
  '- Summary: Projects Report views as dropdown, last selected view persisted to localStorage.',
  '- Changes:',
  '  - components/figma/projects-report-table.tsx: Views selector replaced with dropdown. localStorage persistence for activeViewUuid.',
  '',
  '## 2026-05-14 Deployment #278',
].join('\n');
src = src.replace(ANCHOR, NEW_ENTRY);
fs.writeFileSync('docs/DEPLOYMENT_LOG.md', src, 'utf8');
console.log('Done');
