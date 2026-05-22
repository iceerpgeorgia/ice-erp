const fs = require('fs');

// ─── Patch route.ts ───────────────────────────────────────────────────────────
{
  const path = 'app/api/projects-report/route.ts';
  let src = fs.readFileSync(path, 'utf8');

  // 1. Add waybillPairedFcUuid to the type definition (after waybillPairedFcCode)
  const oldType = `      waybillPairedFcCode: string | null;\r\n      waybillPairedFcValidation: string | null;`;
  const newType = `      waybillPairedFcCode: string | null;\r\n      waybillPairedFcUuid: string | null;\r\n      waybillPairedFcValidation: string | null;`;
  if (!src.includes(oldType)) { console.error('FAIL: type definition not found in route.ts'); process.exit(1); }
  src = src.replace(oldType, newType);

  // 2. Add waybillPairedFcUuid: null to initial project data
  const oldInit = `          waybillPairedFcCode: null,\r\n          waybillPairedFcValidation: null,`;
  const newInit = `          waybillPairedFcCode: null,\r\n          waybillPairedFcUuid: null,\r\n          waybillPairedFcValidation: null,`;
  if (!src.includes(oldInit)) { console.error('FAIL: init block not found in route.ts'); process.exit(1); }
  src = src.replace(oldInit, newInit);

  // 3. Add cost_fc.uuid::text AS paired_fc_uuid to SELECT
  const oldSelect = `        cost_fc.code AS paired_fc_code,\r\n        COALESCE(cost_fc.validation, cost_fc.code) AS paired_fc_validation`;
  const newSelect = `        cost_fc.uuid::text AS paired_fc_uuid,\r\n        cost_fc.code AS paired_fc_code,\r\n        COALESCE(cost_fc.validation, cost_fc.code) AS paired_fc_validation`;
  if (!src.includes(oldSelect)) { console.error('FAIL: SELECT block not found in route.ts'); process.exit(1); }
  src = src.replace(oldSelect, newSelect);

  // 4. Add cost_fc.uuid to GROUP BY
  const oldGroup = `      GROUP BY proj.project_uuid, proj.financial_code_uuid, cost_fc.code, cost_fc.validation`;
  const newGroup = `      GROUP BY proj.project_uuid, proj.financial_code_uuid, cost_fc.uuid, cost_fc.code, cost_fc.validation`;
  if (!src.includes(oldGroup)) { console.error('FAIL: GROUP BY not found in route.ts'); process.exit(1); }
  src = src.replace(oldGroup, newGroup);

  // 5. Store waybillPairedFcUuid in merge loop
  const oldMerge = `        proj.waybillPairedFcCode = (wRow.paired_fc_code as string) || null;\r\n        proj.waybillPairedFcValidation = (wRow.paired_fc_validation as string) || null;`;
  const newMerge = `        proj.waybillPairedFcCode = (wRow.paired_fc_code as string) || null;\r\n        proj.waybillPairedFcUuid = (wRow.paired_fc_uuid as string) || null;\r\n        proj.waybillPairedFcValidation = (wRow.paired_fc_validation as string) || null;`;
  if (!src.includes(oldMerge)) { console.error('FAIL: merge block not found in route.ts'); process.exit(1); }
  src = src.replace(oldMerge, newMerge);

  fs.writeFileSync(path, src, 'utf8');
  console.log('✅ route.ts patched');
}

// ─── Patch projects-report-table.tsx ─────────────────────────────────────────
{
  const path = 'components/figma/projects-report-table.tsx';
  let src = fs.readFileSync(path, 'utf8');

  // 1. Add waybillPairedFcUuid to ProjectData type
  const oldTypeComp = `  waybillPairedFcCode: string | null;\r\n  waybillPairedFcValidation: string | null;`;
  const newTypeComp = `  waybillPairedFcCode: string | null;\r\n  waybillPairedFcUuid: string | null;\r\n  waybillPairedFcValidation: string | null;`;
  if (!src.includes(oldTypeComp)) { console.error('FAIL: component type not found'); process.exit(1); }
  src = src.replace(oldTypeComp, newTypeComp);

  // 2. Extend globalFcMap to include cost FCs from waybill data
  const oldGlobalFcMap = `    return map;\r\n  }, [report]);`;
  const newGlobalFcMap = `    // Also add cost FCs from waybill data so waybill column appears even if no project has payments to that FC\r\n    for (const proj of report.projects) {\r\n      if (proj.waybillPairedFcUuid && proj.waybillPairedFcCode && !map.has(proj.waybillPairedFcUuid)) {\r\n        map.set(proj.waybillPairedFcUuid, { uuid: proj.waybillPairedFcUuid, validation: proj.waybillPairedFcValidation ?? proj.waybillPairedFcCode, code: proj.waybillPairedFcCode, isIncome: false });\r\n      }\r\n    }\r\n    return map;\r\n  }, [report]);`;
  if (!src.includes(oldGlobalFcMap)) { console.error('FAIL: globalFcMap return block not found'); process.exit(1); }
  src = src.replace(oldGlobalFcMap, newGlobalFcMap);

  // 3. Replace buildPivot waybillFcMap logic — key on cost FC UUID directly
  const oldWaybill = `    // Build waybillFcMap from project-level waybill data (not per-cell).\r\n    // The waybill is associated with the project's income FC (projects.financial_code_uuid).\r\n    // Fallback: if project FC isn't a payment column, use the first income FC in fcList.\r\n    const waybillFcMap = new Map<string, string>();\r\n    if (proj.waybillSum > 0 && proj.waybillPairedFcCode) {\r\n      const projectFcInList = proj.projectFcUuid ? fcList.find(fc => fc.uuid === proj.projectFcUuid) : null;\r\n      if (projectFcInList) {\r\n        waybillFcMap.set(projectFcInList.uuid, proj.waybillPairedFcCode);\r\n      } else {\r\n        // Fallback: first income FC column (for projects with sub-code payments like 1.1.1.1)\r\n        const firstIncomeFc = fcList.find(fc => fc.isIncome);\r\n        if (firstIncomeFc) waybillFcMap.set(firstIncomeFc.uuid, proj.waybillPairedFcCode);\r\n      }\r\n    }`;
  const newWaybill = `    // Build waybillFcMap: key is the cost FC UUID (from financial_codes.default_code_fc),\r\n    // value is 'Waybill' label. The amber sub-column appears inside the cost FC column.\r\n    const waybillFcMap = new Map<string, string>();\r\n    if (proj.waybillSum > 0 && proj.waybillPairedFcUuid) {\r\n      waybillFcMap.set(proj.waybillPairedFcUuid, 'Waybill');\r\n    }`;
  if (!src.includes(oldWaybill)) { console.error('FAIL: buildPivot waybillFcMap block not found'); process.exit(1); }
  src = src.replace(oldWaybill, newWaybill);

  fs.writeFileSync(path, src, 'utf8');
  console.log('✅ projects-report-table.tsx patched');
}

console.log('All patches applied.');
