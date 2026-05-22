const fs = require('fs');
let src = fs.readFileSync('components/figma/projects-report-table.tsx', 'utf8');

// ── 1. Update ProjectData type: add project-level waybill fields ──
const OLD_PROJ_TYPE = '  totalJobsInProject: number;\n  allJobs: { jobUuid: string; jobName: string; floors: number }[];\n  cells: CellData[];';
const NEW_PROJ_TYPE = '  totalJobsInProject: number;\n  allJobs: { jobUuid: string; jobName: string; floors: number }[];\n  waybillSum: number;\n  projectFcUuid: string | null;\n  waybillPairedFcCode: string | null;\n  waybillPairedFcValidation: string | null;\n  cells: CellData[];';
if (!src.includes(OLD_PROJ_TYPE)) { console.error('ProjectData type not found'); process.exit(1); }
src = src.replace(OLD_PROJ_TYPE, NEW_PROJ_TYPE);
console.log('Step 1 (ProjectData type): OK');

// ── 2. Remove waybillSum, pairedFcCode, pairedFcValidation from CellData ──
const OLD_CELL_TYPE = '  waybillSum: number;\n  pairedFcCode: string | null;\n  pairedFcValidation: string | null;\n};';
if (!src.includes(OLD_CELL_TYPE)) { console.error('CellData waybill fields not found'); process.exit(1); }
src = src.replace(OLD_CELL_TYPE, '};');
console.log('Step 2 (remove CellData waybill fields): OK');

// ── 3. Replace waybillFcMap computation in buildPivot ──
// Use project-level fields: proj.projectFcUuid + proj.waybillPairedFcCode
const OLD_MAP = '    // Build waybillFcMap directly from proj.cells (more reliable than iterating cellMap)\n    // Maps income FC uuid → paired cost FC code label (e.g. \'2.1.1.6\')\n    const waybillFcMap = new Map<string, string>();\n    for (const cell of proj.cells) {\n      if (cell.waybillSum > 0 && cell.pairedFcCode) {\n        waybillFcMap.set(cell.financialCodeUuid, cell.pairedFcCode);\n      }\n    }';
const NEW_MAP = '    // Build waybillFcMap from project-level waybill data (not per-cell).\n    // The waybill is associated with the project\'s income FC (projects.financial_code_uuid).\n    // Fallback: if project FC isn\'t a payment column, use the first income FC in fcList.\n    const waybillFcMap = new Map<string, string>();\n    if (proj.waybillSum > 0 && proj.waybillPairedFcCode) {\n      const projectFcInList = proj.projectFcUuid ? fcList.find(fc => fc.uuid === proj.projectFcUuid) : null;\n      if (projectFcInList) {\n        waybillFcMap.set(projectFcInList.uuid, proj.waybillPairedFcCode);\n      } else {\n        // Fallback: first income FC column (for projects with sub-code payments like 1.1.1.1)\n        const firstIncomeFc = fcList.find(fc => fc.isIncome);\n        if (firstIncomeFc) waybillFcMap.set(firstIncomeFc.uuid, proj.waybillPairedFcCode);\n      }\n    }';
if (!src.includes(OLD_MAP)) { console.error('waybillFcMap computation not found'); process.exit(1); }
src = src.replace(OLD_MAP, NEW_MAP);
console.log('Step 3 (waybillFcMap computation): OK');

// ── 4. Update body cell waybill rendering: show '-' per job (waybill is project-level) ──
// Find the body waybill td and replace its content
const OLD_BODY = 'if (waybillFcMap.has(fc.uuid)) {\n                                metricTds.push(\n                                  <td';
const bodyIdx = src.indexOf(OLD_BODY);
if (bodyIdx === -1) { console.error('Body waybill td not found'); process.exit(1); }
// Find the closing of this if block — look for the corresponding closing brace
// Read from bodyIdx forward to find the full if block
let depth = 0;
let inIf = false;
let blockEnd = -1;
for (let i = bodyIdx + OLD_BODY.length; i < src.length; i++) {
  if (src[i] === '{') { depth++; inIf = true; }
  if (src[i] === '}') { depth--; if (inIf && depth < 0) { blockEnd = i + 1; break; } }
}
if (blockEnd === -1) { console.error('Body if block end not found'); process.exit(1); }
const fullBodyBlock = src.slice(bodyIdx, blockEnd);
console.log('Body block found, length:', fullBodyBlock.length);

// Find the closing ); after the td block
const afterBlock = src.slice(blockEnd);
const closingParen = afterBlock.indexOf(');');
const fullReplaceEnd = blockEnd + closingParen + 2;
const fullBodySection = src.slice(bodyIdx, fullReplaceEnd);

// Build replacement: show '-' for per-job waybill rows
const NEW_BODY = `if (waybillFcMap.has(fc.uuid)) {
                                const wKey = \`\${fc.uuid}:waybillSum\`;
                                const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);
                                metricTds.push(
                                  <td
                                    key={\`\${job.key}:\${fc.uuid}:waybillSum\`}
                                    className="px-2 py-1 text-right text-[11px] text-amber-600 bg-amber-50 border-r border-amber-200"
                                    style={{ width: wColW, minWidth: wColW }}
                                  >
                                    {/* Waybill is project-level; shown in totals row only */}
                                    <span className="text-gray-300">-</span>
                                  </td>
                                );
                              }`;
src = src.slice(0, bodyIdx) + NEW_BODY + src.slice(fullReplaceEnd);
console.log('Step 4 (body waybill cell: show dash): OK');

// ── 5. Update totals row waybill: use proj.waybillSum directly ──
const OLD_TOTALS = 'if (waybillFcMap.has(fc.uuid)) {\n                            const waybillTotal = jobList.reduce((sum, job) => {';
const totalsIdx = src.indexOf(OLD_TOTALS);
if (totalsIdx === -1) { console.error('Totals waybill block not found'); process.exit(1); }
// Find end of this if block
let t_depth = 0;
let t_inIf = false;
let t_blockEnd = -1;
for (let i = totalsIdx + OLD_TOTALS.length; i < src.length; i++) {
  if (src[i] === '{') { t_depth++; t_inIf = true; }
  if (src[i] === '}') { t_depth--; if (t_inIf && t_depth < 0) { t_blockEnd = i + 1; break; } }
}
if (t_blockEnd === -1) { console.error('Totals if block end not found'); process.exit(1); }
const afterTotals = src.slice(t_blockEnd);
const t_closingParen = afterTotals.indexOf(');');
const t_fullEnd = t_blockEnd + t_closingParen + 2;
const fullTotalsSection = src.slice(totalsIdx, t_fullEnd);
console.log('Totals block found, length:', fullTotalsSection.length);

const NEW_TOTALS = `if (waybillFcMap.has(fc.uuid)) {
                            // Waybill total comes from project-level aggregate (not summed per-job)
                            const waybillTotal = proj.waybillSum;
                            const wKey = \`\${fc.uuid}:waybillSum\`;
                            const wColW = getColWidth(wKey, autoColWidthsMap.get(wKey) ?? 60);
                            totalTds.push(
                              <td
                                key={\`total:\${fc.uuid}:waybillSum\`}
                                className="px-2 py-1 text-right text-[11px] font-semibold text-amber-700 bg-amber-100 border-r border-amber-200"
                                style={{ width: wColW, minWidth: wColW }}
                              >
                                {waybillTotal > 0 ? formatMoney(waybillTotal) : '-'}
                              </td>
                            );
                          }`;
src = src.slice(0, totalsIdx) + NEW_TOTALS + src.slice(t_fullEnd);
console.log('Step 5 (totals waybill: use proj.waybillSum): OK');

fs.writeFileSync('components/figma/projects-report-table.tsx', src);
console.log('\nAll UI patches applied.');
