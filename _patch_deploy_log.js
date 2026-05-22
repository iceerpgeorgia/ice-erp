const fs = require('fs');
let src = fs.readFileSync('docs/DEPLOYMENT_LOG.md', 'utf8').replace(/\r\n/g, '\n');
const ENTRY = `
## Deployment #280

- **Date**: 2025-07-14
- **Commit**: ac30ee6
- **Description**: feat(projects-report): add waybill sum via default_code_fc pairing
  - Added \`default_code_fc\` column to \`financial_codes\` (Prisma schema)
  - Projects Report API: waybill_agg CTE queries rs_waybills_in, joined via fc_pair lookup
  - Projects Report UI: Waybills metric column (MetricKey, METRIC_LABELS, CellData)
  - Financial codes UI: "Paired Cost FC for Waybills" selector + table column
- **Production URL**: https://ice-7n0gl33c7-iceerp.vercel.app

`;
// Insert after the first line (# DEPLOYMENT LOG)
const idx = src.indexOf('\n');
src = src.slice(0, idx + 1) + ENTRY + src.slice(idx + 1);
fs.writeFileSync('docs/DEPLOYMENT_LOG.md', src, 'utf8');
console.log('done');
