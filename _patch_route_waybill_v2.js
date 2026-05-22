const fs = require('fs');
let src = fs.readFileSync('app/api/projects-report/route.ts', 'utf8');

// ── 1. Remove waybill_agg CTE ──
const CTE_MARKER = 'waybill_agg AS (';
const cteStart = src.indexOf(CTE_MARKER);
if (cteStart === -1) { console.error('waybill_agg CTE not found'); process.exit(1); }
const cteBody = src.slice(cteStart);
const cteEndMatch = cteBody.match(/\n      \)\n/);
if (!cteEndMatch) { console.error('CTE end not found'); process.exit(1); }
const cteEnd = cteStart + cteEndMatch.index + cteEndMatch[0].length;
const precedingComma = src.slice(0, cteStart).lastIndexOf(',\n');
src = src.slice(0, precedingComma) + '\n' + src.slice(cteEnd);
console.log('Step 1 (remove waybill_agg CTE): OK');

// ── 2. Remove fc_pair + cost_fc + waybill_agg joins ──
const JOINS_START = '      LEFT JOIN (\n        SELECT uuid::text AS fc_uuid, default_code_fc::text AS default_cost_fc';
const JOINS_END = '       AND fc_pair.fc_uuid IS NOT NULL\n';
const jsStart = src.indexOf(JOINS_START);
const jsEnd = src.indexOf(JOINS_END);
if (jsStart === -1 || jsEnd === -1) { console.error('Joins not found'); process.exit(1); }
src = src.slice(0, jsStart) + src.slice(jsEnd + JOINS_END.length);
console.log('Step 2 (remove joins): OK');

// ── 3. Remove waybill_sum + paired_fc_* from SELECT ──
const SEL = '        COALESCE(MAX(wa.waybill_sum), 0) AS waybill_sum,\n        MAX(cost_fc.code) AS paired_fc_code,\n        MAX(COALESCE(cost_fc.validation, cost_fc.code)) AS paired_fc_validation\n';
if (!src.includes(SEL)) { console.error('SELECT not found'); process.exit(1); }
src = src.replace(SEL, '');
console.log('Step 3 (remove SELECT): OK');

// ── 4. Remove waybill fields from cells inline type ──
const OLD_TYPE = '        waybillSum: number;\n        pairedFcCode: string | null;\n        pairedFcValidation: string | null;\n';
if (!src.includes(OLD_TYPE)) { console.error('Type not found'); process.exit(1); }
src = src.replace(OLD_TYPE, '');
console.log('Step 4 (remove inline cell type): OK');

// ── 5. Remove waybill fields from cells.push ──
const OLD_PUSH = '        waybillSum: Number(row.waybill_sum || 0),\n        pairedFcCode: (row.paired_fc_code as string) || null,\n        pairedFcValidation: (row.paired_fc_validation as string) || null,\n';
if (!src.includes(OLD_PUSH)) { console.error('Push not found'); process.exit(1); }
src = src.replace(OLD_PUSH, '');
console.log('Step 5 (remove cells.push waybill): OK');

// ── 6. Add project-level waybill fields to projectMap type ──
const OLD_MAP_TYPE = '      allJobs: { jobUuid: string; jobName: string; floors: number }[];\n      cells: {';
const NEW_MAP_TYPE = '      allJobs: { jobUuid: string; jobName: string; floors: number }[];\n      waybillSum: number;\n      projectFcUuid: string | null;\n      waybillPairedFcCode: string | null;\n      waybillPairedFcValidation: string | null;\n      cells: {';
if (!src.includes(OLD_MAP_TYPE)) { console.error('Map type not found'); process.exit(1); }
src = src.replace(OLD_MAP_TYPE, NEW_MAP_TYPE);
console.log('Step 6 (add project waybill type): OK');

// ── 7. Initialize waybill fields in new project entry ──
const OLD_INIT = '          totalJobsInProject: jobCountByProject.get(key) ?? 0,\n          allJobs: allJobsByProject.get(key) ?? [],\n          cells: [],';
const NEW_INIT = '          totalJobsInProject: jobCountByProject.get(key) ?? 0,\n          allJobs: allJobsByProject.get(key) ?? [],\n          waybillSum: 0,\n          projectFcUuid: null,\n          waybillPairedFcCode: null,\n          waybillPairedFcValidation: null,\n          cells: [],';
if (!src.includes(OLD_INIT)) { console.error('Init not found'); process.exit(1); }
src = src.replace(OLD_INIT, NEW_INIT);
console.log('Step 7 (init project waybill): OK');

// ── 8. Add second query for project-level waybill before the return ──
const OLD_RETURN = '    // Preserve the order of selected projects\n    const projects = projectUuids';
if (!src.includes(OLD_RETURN)) { console.error('Return anchor not found'); process.exit(1); }

// Build the second query string without problematic template literal nesting
const SECOND_QUERY_LINES = [
  '    // ── Project-level waybill query (uses project.financial_code_uuid, not payment FC) ──',
  '    // Correctly handles projects where payments use sub-codes (1.1.1.1) but project FC is parent (1.1.1).',
  '    const waybillQuery = `',
  '      SELECT',
  '        proj.project_uuid::text,',
  '        SUM(',
  '          (COALESCE(w.sum, 0) / CASE WHEN w.vat = true THEN 1.18 ELSE 1.0 END)',
  "          * ${convFactor(\"'GEL'\", 'nbg_w')}",
  '        ) AS waybill_sum,',
  '        proj.financial_code_uuid::text AS project_fc_uuid,',
  '        cost_fc.code AS paired_fc_code,',
  '        COALESCE(cost_fc.validation, cost_fc.code) AS paired_fc_validation',
  '      FROM projects proj',
  '      JOIN rs_waybills_in w ON w.project_uuid = proj.project_uuid',
  '      LEFT JOIN LATERAL (',
  '        SELECT usd_rate, eur_rate FROM nbg_exchange_rates',
  '        WHERE date <= COALESCE(w.activation_time::date, CURRENT_DATE) ORDER BY date DESC LIMIT 1',
  '      ) nbg_w ON true',
  '      LEFT JOIN financial_codes fc_income ON fc_income.uuid = proj.financial_code_uuid',
  '      LEFT JOIN financial_codes cost_fc ON cost_fc.uuid = fc_income.default_code_fc',
  '      WHERE proj.project_uuid::text IN (${projectPlaceholders})',
  '        ${maxDate ? `AND COALESCE(w.activation_time::date, CURRENT_DATE) <= \'${maxDate}\'::date` : \'\'}',
  '      GROUP BY proj.project_uuid, proj.financial_code_uuid, cost_fc.code, cost_fc.validation',
  '      HAVING SUM(COALESCE(w.sum, 0)) > 0',
  '    `;',
  '    const waybillRows = await prisma.$queryRawUnsafe<any[]>(waybillQuery, ...queryParams);',
  '    for (const wRow of waybillRows) {',
  '      const proj = projectMap.get(wRow.project_uuid as string);',
  '      if (proj) {',
  '        proj.waybillSum = Number(wRow.waybill_sum || 0);',
  '        proj.projectFcUuid = (wRow.project_fc_uuid as string) || null;',
  '        proj.waybillPairedFcCode = (wRow.paired_fc_code as string) || null;',
  '        proj.waybillPairedFcValidation = (wRow.paired_fc_validation as string) || null;',
  '      }',
  '    }',
  '',
  '    // Preserve the order of selected projects',
  '    const projects = projectUuids',
];

src = src.replace(OLD_RETURN, SECOND_QUERY_LINES.join('\n'));
console.log('Step 8 (add second query): OK');

fs.writeFileSync('app/api/projects-report/route.ts', src);
console.log('\nAll patches applied.');
