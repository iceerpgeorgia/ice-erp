const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8').replace(/\r\n/g, '\n');

// ── Step 1: Add cost_fc join to get the paired FC code ──────────────────────
const OLD_JOIN = `      LEFT JOIN (
        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
        FROM financial_codes
        WHERE default_code_fc IS NOT NULL
      ) fc_pair ON fc_pair.fc_uuid = sp.financial_code_uuid::text
      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = sp.project_uuid::text
       AND fc_pair.fc_uuid IS NOT NULL`;

const NEW_JOIN = `      LEFT JOIN (
        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc
        FROM financial_codes
        WHERE default_code_fc IS NOT NULL
      ) fc_pair ON fc_pair.fc_uuid = sp.financial_code_uuid::text
      LEFT JOIN financial_codes cost_fc ON cost_fc.uuid::text = fc_pair.default_cost_fc
      LEFT JOIN waybill_agg wa
        ON wa.project_uuid = sp.project_uuid::text
       AND fc_pair.fc_uuid IS NOT NULL`;

const c1 = src.split(OLD_JOIN).length - 1;
if (c1 !== 1) { console.error('Step 1 count:', c1); process.exit(1); }
src = src.replace(OLD_JOIN, NEW_JOIN);
console.log('Step 1: cost_fc join added');

// ── Step 2: Add paired_fc_code and paired_fc_validation to SELECT ───────────
const OLD_SEL = '        COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum\n      FROM selected_payments sp';
const NEW_SEL = `        COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum,
        MAX(cost_fc.code) AS paired_fc_code,
        MAX(COALESCE(cost_fc.validation, cost_fc.code)) AS paired_fc_validation
      FROM selected_payments sp`;
const c2 = src.split(OLD_SEL).length - 1;
if (c2 !== 1) { console.error('Step 2 count:', c2); process.exit(1); }
src = src.replace(OLD_SEL, NEW_SEL);
console.log('Step 2: paired_fc_code + paired_fc_validation added to SELECT');

// ── Step 3: Add to cells.push ────────────────────────────────────────────────
const OLD_PUSH = '        waybillSum: Number(row.waybill_sum || 0),\n      });';
const NEW_PUSH = `        waybillSum: Number(row.waybill_sum || 0),
        pairedFcCode: (row.paired_fc_code as string) || null,
        pairedFcValidation: (row.paired_fc_validation as string) || null,
      });`;
const c3 = src.split(OLD_PUSH).length - 1;
if (c3 !== 1) { console.error('Step 3 count:', c3); process.exit(1); }
src = src.replace(OLD_PUSH, NEW_PUSH);
console.log('Step 3: pairedFcCode + pairedFcValidation added to cells.push');

fs.writeFileSync('app/api/projects-report/route.ts', src, 'utf8');
console.log('API patch done.');
