const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// 1. Add waybill_agg CTE before the final SELECT
const ANCHOR1 = "        GROUP BY pa.payment_id\n      )\n      SELECT\n        sp.project_uuid,";
const c1 = src.split(ANCHOR1).length - 1;
if (c1 !== 1) { console.error('Step 1 count:', c1); process.exit(1); }
src = src.replace(ANCHOR1, [
  "        GROUP BY pa.payment_id",
  "      ),",
  "      waybill_agg AS (",
  "        SELECT",
  "          w.project_uuid::text AS project_uuid,",
  "          w.financial_code_uuid::text AS financial_code_uuid,",
  "          SUM(COALESCE(w.sum, 0) * (1.0 / NULLIF(" + (src.includes("'GEL'") ? "" : "") + "CASE '" + "' || '${targetCurrency}' || '",
].join('\n'));
// That approach is messy. Let me do it differently.
console.log('Step 1 would be complex. Aborting for a cleaner approach.');
process.exit(1);
