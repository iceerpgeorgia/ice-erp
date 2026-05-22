const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// 1. Add waybill_agg CTE — inserted right before the final SELECT
const CTE_ANCHOR = '        GROUP BY pa.payment_id\n      )\n      SELECT\n        sp.project_uuid,\n        MAX(sp.project_index)';
const c1 = src.split(CTE_ANCHOR).length - 1;
if (c1 !== 1) { console.error('Step 1 anchor count:', c1); process.exit(1); }

// Build the CTE insertion. We use placeholder tokens so we don't need to deal with template literal nesting.
// The actual TypeScript template expressions like ${convFactor(...)} will be embedded as-is.
const WAYBILL_CTE = `        GROUP BY pa.payment_id
      ),
      waybill_agg AS (
        SELECT
          w.project_uuid::text AS project_uuid,
          w.financial_code_uuid::text AS financial_code_uuid,
          SUM(COALESCE(w.sum, 0) * \${convFactor("'GEL'", 'nbg_w')}) AS waybill_sum
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
        sp.project_uuid,
        MAX(sp.project_index)`;

src = src.replace(CTE_ANCHOR, WAYBILL_CTE);
console.log('Step 1: waybill_agg CTE inserted');

// 2. Replace the final SELECT columns to add waybill_sum
const OLD_LATEST = "        MAX(la.latest_ledger_date) AS latest_date\n      FROM selected_payments sp\n      LEFT JOIN ledger_agg la ON sp.payment_id = la.payment_id\n      LEFT JOIN ledger_latest ll ON sp.payment_id = ll.payment_id\n      LEFT JOIN ledger_last_month llm ON sp.payment_id = llm.payment_id\n      LEFT JOIN bank_agg ba ON sp.payment_id = ba.payment_id\n      LEFT JOIN adj_agg adj ON sp.payment_id = adj.payment_id\n      GROUP BY sp.project_uuid, sp.job_uuid, sp.financial_code_uuid";

const NEW_LATEST = `        MAX(la.latest_ledger_date) AS latest_date,
        COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum
      FROM selected_payments sp
      LEFT JOIN ledger_agg la ON sp.payment_id = la.payment_id
      LEFT JOIN ledger_latest ll ON sp.payment_id = ll.payment_id
      LEFT JOIN ledger_last_month llm ON sp.payment_id = llm.payment_id
      LEFT JOIN bank_agg ba ON sp.payment_id = ba.payment_id
      LEFT JOIN adj_agg adj ON sp.payment_id = adj.payment_id
      LEFT JOIN (
        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
        FROM financial_codes
        WHERE default_code_fc IS NOT NULL
      ) fc_pair ON fc_pair.fc_uuid = sp.financial_code_uuid::text
      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = sp.project_uuid::text
       AND wa.financial_code_uuid = fc_pair.default_cost_fc
      GROUP BY sp.project_uuid, sp.job_uuid, sp.financial_code_uuid`;

const c2 = src.split(OLD_LATEST).length - 1;
if (c2 !== 1) { console.error('Step 2 anchor count:', c2); process.exit(1); }
src = src.replace(OLD_LATEST, NEW_LATEST);
console.log('Step 2: waybill_sum added to SELECT + JOIN added');

// 3. Add waybillSum to the cell push in route handler
const OLD_PENSION = "        pensionOnTax: Boolean(row.pension_on_tax),\n      });";
const NEW_PENSION = "        pensionOnTax: Boolean(row.pension_on_tax),\n        waybillSum: Number(row.waybill_sum || 0),\n      });";
const c3 = src.split(OLD_PENSION).length - 1;
if (c3 !== 1) { console.error('Step 3 anchor count:', c3); process.exit(1); }
src = src.replace(OLD_PENSION, NEW_PENSION);
console.log('Step 3: waybillSum added to cell data');

// 4. Add waybillSum: number to the TypeScript type annotation in projectMap
const OLD_PENSION_TYPE = "        pensionOnTax: boolean;\n      }[];";
const NEW_PENSION_TYPE = "        pensionOnTax: boolean;\n        waybillSum: number;\n      }[];";
const c4 = src.split(OLD_PENSION_TYPE).length - 1;
if (c4 !== 1) { console.error('Step 4 anchor count:', c4); process.exit(1); }
src = src.replace(OLD_PENSION_TYPE, NEW_PENSION_TYPE);
console.log('Step 4: waybillSum type annotation added');

fs.writeFileSync('app/api/projects-report/route.ts', src, 'utf8');
console.log('All done.');
