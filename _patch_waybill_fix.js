const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// ── Fix waybill_agg: group only by project_uuid, remove FC filter ─────────────
const OLD_CTE = `      waybill_agg AS (
        SELECT
          w.project_uuid::text AS project_uuid,
          w.financial_code_uuid::text AS financial_code_uuid,
          SUM((COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) * \${convFactor("'GEL'", 'nbg_w')}) AS waybill_sum
        FROM rs_waybills_in w
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= COALESCE(w.activation_time::date, CURRENT_DATE) ORDER BY date DESC LIMIT 1
        ) nbg_w ON true
        WHERE w.project_uuid IN (\${projectPlaceholders})
          AND w.financial_code_uuid IS NOT NULL
          \${maxDate ? \`AND COALESCE(w.activation_time::date, CURRENT_DATE) <= '\${maxDate}'::date\` : ''}
        GROUP BY w.project_uuid, w.financial_code_uuid
      )`;

const NEW_CTE = `      waybill_agg AS (
        SELECT
          w.project_uuid::text AS project_uuid,
          SUM((COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) * \${convFactor("'GEL'", 'nbg_w')}) AS waybill_sum
        FROM rs_waybills_in w
        LEFT JOIN LATERAL (
          SELECT usd_rate, eur_rate FROM nbg_exchange_rates
          WHERE date <= COALESCE(w.activation_time::date, CURRENT_DATE) ORDER BY date DESC LIMIT 1
        ) nbg_w ON true
        WHERE w.project_uuid IN (\${projectPlaceholders})
          \${maxDate ? \`AND COALESCE(w.activation_time::date, CURRENT_DATE) <= '\${maxDate}'::date\` : ''}
        GROUP BY w.project_uuid
      )`;

const c1 = src.split(OLD_CTE).length - 1;
if (c1 !== 1) { console.error('CTE anchor count:', c1); process.exit(1); }
src = src.replace(OLD_CTE, NEW_CTE);
console.log('Step 1: waybill_agg simplified to group by project only');

// ── Fix JOIN: join waybill_agg on project_uuid when fc_pair exists ────────────
const OLD_JOIN = `      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = sp.project_uuid::text
       AND wa.financial_code_uuid = fc_pair.default_cost_fc`;

const NEW_JOIN = `      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = sp.project_uuid::text
       AND fc_pair.fc_uuid IS NOT NULL`;

const c2 = src.split(OLD_JOIN).length - 1;
if (c2 !== 1) { console.error('JOIN anchor count:', c2); process.exit(1); }
src = src.replace(OLD_JOIN, NEW_JOIN);
console.log('Step 2: JOIN updated — use fc_pair presence as gate instead of cost FC match');

fs.writeFileSync('app/api/projects-report/route.ts', src, 'utf8');
console.log('Patch done.');
