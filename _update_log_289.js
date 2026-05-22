const fs = require('fs');
let src = fs.readFileSync('docs/DEPLOYMENT_LOG.md', 'utf8');

const ENTRY = `## 2026-05-15 Deployment #289
- Commit: ce4ab94
- Production: https://ice-kvxw13va2-iceerp.vercel.app
- Summary: Fix 500 error on /api/projects-report. Trailing comma after \`MAX(la.latest_ledger_date) AS latest_date,\` in the main SELECT list caused \`syntax error at or near "FROM"\`. Removed the trailing comma.
- Changes:
  - app/api/projects-report/route.ts: Removed trailing comma in SELECT clause (line 299).

`;

// Insert after "# Deployment Log\n\n"
src = src.replace('# Deployment Log\n\n', '# Deployment Log\n\n' + ENTRY);
fs.writeFileSync('docs/DEPLOYMENT_LOG.md', src);
console.log('Done.');
