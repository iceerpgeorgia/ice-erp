const fs = require("fs");

// --- projects/route.ts ---
let routeTs = fs.readFileSync("app/api/projects/route.ts", "utf8");

// 1. Remove duplicate isBundleFC POST block (keep only one, the second one)
const dupPattern = /( {6}if \(isBundleFC\) \{[\s\S]*?console\.warn\('Bundle payment creation skipped:'[\s\S]*?\}\n {6}\}\n\n {6}if \(isBundleFC\) \{)/;
routeTs = routeTs.replace(dupPattern, "      if (isBundleFC) {");

// 2. Add is_bundle_payment to POST bundle INSERT (financialCodeUuid)
routeTs = routeTs.replace(
  "currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, updated_at\n              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, NOW())``,\n              project.project_uuid, counteragentUuid, childFC.uuid, currencyUuid, effectiveInsiderUuid",
  "currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at\n              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, true, NOW())``,\n              project.project_uuid, counteragentUuid, childFC.uuid, currencyUuid, effectiveInsiderUuid"
);

// 3. Add is_bundle_payment to PATCH bundle INSERT (project.project_uuid)
routeTs = routeTs.replace(
  "`INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, NOW())`,\n                project.project_uuid, project.counteragent_uuid, childFC.uuid, project.currency_uuid, project.insider_uuid",
  "`INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, true, NOW())`,\n                project.project_uuid, project.counteragent_uuid, childFC.uuid, project.currency_uuid, project.insider_uuid"
);

fs.writeFileSync("app/api/projects/route.ts", routeTs, "utf8");
const count1 = (routeTs.match(/is_bundle_payment/g) || []).length;
console.log("route.ts is_bundle_payment count:", count1);

// --- projects/[id]/route.ts ---
let idRouteTs = fs.readFileSync("app/api/projects/[id]/route.ts", "utf8");
idRouteTs = idRouteTs.replace(
  "`INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, is_project_derived, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', true, NOW())`, proj.project_uuid, proj.counteragent_uuid, childFC.uuid, proj.currency_uuid",
  "`INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, is_project_derived, is_bundle_payment, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', true, true, NOW())`, proj.project_uuid, proj.counteragent_uuid, childFC.uuid, proj.currency_uuid"
);
fs.writeFileSync("app/api/projects/[id]/route.ts", idRouteTs, "utf8");
const count2 = (idRouteTs.match(/is_bundle_payment/g) || []).length;
console.log("[id]/route.ts is_bundle_payment count:", count2);
