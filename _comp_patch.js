const fs = require("fs");
const path = "components/figma/projects-report-table.tsx";
let src = fs.readFileSync(path, "utf8");

// 1. Add waybillPairedFcUuid to ProjectData type
const old1 = "  waybillPairedFcCode: string | null;\n  waybillPairedFcValidation: string | null;";
if (!src.includes(old1)) { console.error("FAIL type"); process.exit(1); }
src = src.replace(old1, "  waybillPairedFcCode: string | null;\n  waybillPairedFcUuid: string | null;\n  waybillPairedFcValidation: string | null;");

// 2. Extend globalFcMap to add waybill cost FCs
const old2 = "    return map;\n  }, [report]);";
if (!src.includes(old2)) { console.error("FAIL globalFcMap return"); process.exit(1); }
const ins2 = "    // Also ensure cost FCs from waybill data are in the map (so col appears even with no direct payments)\n    for (const proj of report.projects) {\n      if (proj.waybillPairedFcUuid && proj.waybillPairedFcCode && !map.has(proj.waybillPairedFcUuid)) {\n        map.set(proj.waybillPairedFcUuid, { uuid: proj.waybillPairedFcUuid, validation: proj.waybillPairedFcValidation ?? proj.waybillPairedFcCode, code: proj.waybillPairedFcCode, isIncome: false });\n      }\n    }\n    return map;\n  }, [report]);";
src = src.replace(old2, ins2);

// 3. Replace buildPivot waybillFcMap block
const bs = src.indexOf("    // Build waybillFcMap from project-level waybill data");
const re = "    return { jobList, fcList, cellMap, waybillFcMap };";
const be = src.indexOf(re, bs);
if (bs === -1 || be === -1) { console.error("FAIL waybill block"); process.exit(1); }
const newBlock = "    // waybillFcMap: key = cost FC UUID (financial_codes.default_code_fc), value = column label.\n    // The amber sub-column appears inside the cost FC column (e.g. 2.1.1.6).\n    const waybillFcMap = new Map();\n    if (proj.waybillSum > 0 && proj.waybillPairedFcUuid) {\n      waybillFcMap.set(proj.waybillPairedFcUuid, \"Waybill\");\n    }\n    ";
src = src.slice(0, bs) + newBlock + src.slice(be);

fs.writeFileSync(path, src, "utf8");
if (!src.includes("waybillFcMap.set(proj.waybillPairedFcUuid")) { console.error("FAIL verify"); process.exit(1); }
console.log("patched OK");
