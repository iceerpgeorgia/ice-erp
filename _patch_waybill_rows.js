const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// ── Step 1: Remove waybill_agg CTE from WITH clause ──────────────────────────
// Cut everything from the comma before 'waybill_agg AS (' up to (and including)
// the CTE's closing ')' — then the next thing is '\n      SELECT'
const WAYBILL_CTE_OPEN = ',\n      waybill_agg AS (';
const WAYBILL_CTE_CLOSE = '\n      )\n      SELECT\n        sp.project_uuid,';

const w1Start = src.indexOf(WAYBILL_CTE_OPEN);
if (w1Start === -1) { console.error('Step 1: waybill_agg start not found'); process.exit(1); }
const w1End = src.indexOf(WAYBILL_CTE_CLOSE, w1Start);
if (w1End === -1) { console.error('Step 1: waybill_agg end not found'); process.exit(1); }
// Cut from w1Start (the comma) to just before WAYBILL_CTE_CLOSE — the close itself starts with '\n      )' which is waybill_agg's closing paren, skip it
const CLOSE_PAREN = '\n      )';
src = src.slice(0, w1Start) + src.slice(w1End + CLOSE_PAREN.length);
console.log('Step 1: waybill_agg CTE removed');

// ── Step 2: Remove waybill_sum from the main SELECT ──────────────────────────
const OLD_LATEST = '        MAX(la.latest_ledger_date) AS latest_date,\n        COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum';
const NEW_LATEST = '        MAX(la.latest_ledger_date) AS latest_date';
const c2 = src.split(OLD_LATEST).length - 1;
if (c2 !== 1) { console.error('Step 2 count:', c2); process.exit(1); }
src = src.replace(OLD_LATEST, NEW_LATEST);
console.log('Step 2: waybill_sum removed from main SELECT');

// ── Step 3: Remove fc_pair and waybill_agg LEFT JOINs ────────────────────────
const OLD_JOINS = '      LEFT JOIN adj_agg adj ON sp.payment_id = adj.payment_id\n      LEFT JOIN (\n        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc\n        FROM financial_codes\n        WHERE default_code_fc IS NOT NULL\n      ) fc_pair ON fc_pair.fc_uuid = sp.financial_code_uuid::text\n      LEFT JOIN waybill_agg wa\n        ON wa.project_uuid = sp.project_uuid::text\n       AND wa.financial_code_uuid = fc_pair.default_cost_fc\n      GROUP BY';
const NEW_JOINS = '      LEFT JOIN adj_agg adj ON sp.payment_id = adj.payment_id\n      GROUP BY';
const c3 = src.split(OLD_JOINS).length - 1;
if (c3 !== 1) { console.error('Step 3 count:', c3); process.exit(1); }
src = src.replace(OLD_JOINS, NEW_JOINS);
console.log('Step 3: fc_pair and waybill_agg joins removed');

// ── Step 4: Set waybillSum to 0 for payment rows ─────────────────────────────
const OLD_WS = '        waybillSum: Number(row.waybill_sum || 0),';
const NEW_WS = '        waybillSum: 0,';
const c4 = src.split(OLD_WS).length - 1;
if (c4 !== 1) { console.error('Step 4 count:', c4); process.exit(1); }
src = src.replace(OLD_WS, NEW_WS);
console.log('Step 4: waybillSum set to 0 for payment rows');

// ── Step 5: Insert waybill query after the main rows loop ─────────────────────
// Anchor: end of cells.push block + end of for loop + Preserve comment
const LOOP_END_ANCHOR = '        waybillSum: 0,\n      });\n    }\n\n    // Preserve the order of selected projects';

const WAYBILL_QUERY_CODE = [
  '        waybillSum: 0,',
  '      });',
  '    }',
  '',
  '    // Waybill rows: separate cells per cost FC, paired via default_code_fc',
  '    const waybillRowQuery = `',
  '      SELECT',
  '        w.project_uuid::text AS project_uuid,',
  '        w.financial_code_uuid::text AS financial_code_uuid,',
  '        COALESCE(fc.validation, fc.code, \'-\') AS fc_validation,',
  '        COALESCE(fc.code, \'-\') AS fc_code,',
  '        COALESCE(fc.is_income, false) AS fc_is_income,',
  '        SUM((COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END) * ${convFactor("\'GEL\'", \'nbg_w\')}) AS waybill_sum',
  '      FROM rs_waybills_in w',
  '      LEFT JOIN LATERAL (',
  '        SELECT usd_rate, eur_rate FROM nbg_exchange_rates',
  '        WHERE date <= COALESCE(w.activation_time::date, CURRENT_DATE) ORDER BY date DESC LIMIT 1',
  '      ) nbg_w ON true',
  '      LEFT JOIN financial_codes fc ON fc.uuid = w.financial_code_uuid',
  '      WHERE w.project_uuid IN (${projectPlaceholders})',
  '        AND w.financial_code_uuid IS NOT NULL',
  '        AND w.financial_code_uuid IN (SELECT default_code_fc FROM financial_codes WHERE default_code_fc IS NOT NULL)',
  '        ${maxDate ? `AND COALESCE(w.activation_time::date, CURRENT_DATE) <= \'${maxDate}\'::date` : \'\'}',
  '      GROUP BY w.project_uuid, w.financial_code_uuid, fc.validation, fc.code, fc.is_income',
  '    `;',
  '    const waybillRows = await prisma.$queryRawUnsafe<any[]>(waybillRowQuery, ...projectUuids);',
  '    for (const wr of waybillRows) {',
  '      const wKey = wr.project_uuid as string;',
  '      if (!projectMap.has(wKey)) continue;',
  '      projectMap.get(wKey)!.cells.push({',
  '        jobUuid: null,',
  '        jobName: null,',
  '        financialCodeUuid: wr.financial_code_uuid as string,',
  '        financialCodeValidation: wr.fc_validation as string,',
  '        financialCodeCode: wr.fc_code as string,',
  '        financialCodeIsIncome: Boolean(wr.fc_is_income),',
  '        accrual: 0,',
  '        latestAccrual: 0,',
  '        order: 0,',
  '        lastMonthAccrual: 0,',
  '        lastMonthOrder: 0,',
  '        payment: 0,',
  '        due: 0,',
  '        balance: 0,',
  '        confirmed: true,',
  '        paymentCount: 0,',
  '        accrualPerFloor: 0,',
  '        jobFloors: 0,',
  '        paymentIds: [],',
  '        latestDate: null,',
  '        accrualTax: 0,',
  '        latestAccrualTax: 0,',
  '        orderTax: 0,',
  '        lastMonthAccrualTax: 0,',
  '        lastMonthOrderTax: 0,',
  '        paymentTax: 0,',
  '        pensionOnTax: false,',
  '        waybillSum: Number(wr.waybill_sum || 0),',
  '      });',
  '    }',
  '',
  '    // Preserve the order of selected projects',
].join('\n');

const c5 = src.split(LOOP_END_ANCHOR).length - 1;
if (c5 !== 1) { console.error('Step 5 count:', c5); process.exit(1); }
src = src.replace(LOOP_END_ANCHOR, WAYBILL_QUERY_CODE);
console.log('Step 5: waybill query section inserted');

fs.writeFileSync('app/api/projects-report/route.ts', src, 'utf8');
console.log('All done.');
