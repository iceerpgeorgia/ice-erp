const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// ── Step 1: Add waybill_agg CTE before final SELECT ──────────────────────────
const CTE_ANCHOR = '        GROUP BY pa.payment_id\n      )\n      SELECT\n        sp.project_uuid,';
const c1 = src.split(CTE_ANCHOR).length - 1;
if (c1 !== 1) { console.error('Step 1 anchor count:', c1); process.exit(1); }

src = src.replace(CTE_ANCHOR, `        GROUP BY pa.payment_id
      ),
      waybill_agg AS (
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
      )
      SELECT
        sp.project_uuid,`);
console.log('Step 1: waybill_agg CTE added');

// ── Step 2: Add waybill_sum to the main SELECT ────────────────────────────────
const OLD_SEL = '        MAX(la.latest_ledger_date) AS latest_date\n      FROM selected_payments sp';
const NEW_SEL = `        MAX(la.latest_ledger_date) AS latest_date,
        COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum
      FROM selected_payments sp`;
const c2 = src.split(OLD_SEL).length - 1;
if (c2 !== 1) { console.error('Step 2 count:', c2); process.exit(1); }
src = src.replace(OLD_SEL, NEW_SEL);
console.log('Step 2: waybill_sum added to SELECT');

// ── Step 3: Add fc_pair + waybill_agg JOINs before GROUP BY ──────────────────
const OLD_GRP = '      LEFT JOIN adj_agg adj ON sp.payment_id = adj.payment_id\n      GROUP BY sp.project_uuid, sp.job_uuid, sp.financial_code_uuid';
const NEW_GRP = `      LEFT JOIN adj_agg adj ON sp.payment_id = adj.payment_id
      LEFT JOIN (
        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
        FROM financial_codes
        WHERE default_code_fc IS NOT NULL
      ) fc_pair ON fc_pair.fc_uuid = sp.financial_code_uuid::text
      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = sp.project_uuid::text
       AND wa.financial_code_uuid = fc_pair.default_cost_fc
      GROUP BY sp.project_uuid, sp.job_uuid, sp.financial_code_uuid`;
const c3 = src.split(OLD_GRP).length - 1;
if (c3 !== 1) { console.error('Step 3 count:', c3); process.exit(1); }
src = src.replace(OLD_GRP, NEW_GRP);
console.log('Step 3: fc_pair + waybill_agg JOINs added');

// ── Step 4: Restore waybillSum from row in cells.push ────────────────────────
const OLD_WS = '        waybillSum: 0,';
const NEW_WS = '        waybillSum: Number(row.waybill_sum || 0),';
const c4 = src.split(OLD_WS).length - 1;
if (c4 !== 1) { console.error('Step 4 count:', c4); process.exit(1); }
src = src.replace(OLD_WS, NEW_WS);
console.log('Step 4: waybillSum restored from row data');

// ── Step 5: Remove the separate waybill post-query ───────────────────────────
const WAYBILL_POST_START = '\n    // Waybill rows: separate cells per cost FC, paired via default_code_fc\n    const waybillRowQuery';
const WAYBILL_POST_END = '\n    // Preserve the order of selected projects';
const ws5 = src.indexOf(WAYBILL_POST_START);
const we5 = src.indexOf(WAYBILL_POST_END, ws5);
if (ws5 === -1 || we5 === -1) { console.error('Step 5: waybill post-query not found'); process.exit(1); }
src = src.slice(0, ws5) + src.slice(we5);
console.log('Step 5: separate waybill post-query removed');

fs.writeFileSync('app/api/projects-report/route.ts', src, 'utf8');
console.log('Route patch done.');
