const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

const OLD = `          SUM(COALESCE(w.sum, 0) * \${convFactor("'GEL'", 'nbg_w')}) AS waybill_sum`;
const NEW = `          SUM((COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) * \${convFactor("'GEL'", 'nbg_w')}) AS waybill_sum`;

const c = src.split(OLD).length - 1;
if (c !== 1) { console.error('Anchor count:', c); process.exit(1); }
src = src.replace(OLD, NEW);
fs.writeFileSync('app/api/projects-report/route.ts', src, 'utf8');
console.log('Done: VAT division added to waybill_agg CTE');
