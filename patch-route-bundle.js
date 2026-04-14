const fs = require("fs");
let c = fs.readFileSync("app/api/projects/route.ts", "utf8");

// 1. POST: remove duplicate isBundleFC block, keep one with is_bundle_payment
const marker = "      if (isBundleFC) {";
const firstIdx = c.indexOf(marker);
const secondIdx = c.indexOf(marker, firstIdx + marker.length);
const afterSecond = c.indexOf("    } catch (paymentError", secondIdx);
const blockText = c.substring(secondIdx, afterSecond).trimEnd();
const updatedBlock = blockText
  .replace("currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, updated_at\n              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, NOW())",
           "currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at\n              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, true, NOW())");
c = c.substring(0, firstIdx) + updatedBlock + "\n" + c.substring(afterSecond);
console.log("POST is_bundle_payment count:", (c.match(/is_bundle_payment/g)||[]).length);

// 2. PATCH: add is_bundle_payment to INSERT
const oldP = "INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, NOW())";
const newP = "INSERT INTO payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, true, NOW())";
if (c.includes(oldP)) { c = c.replace(oldP, newP); console.log("PATCH OK"); } else { console.log("PATCH NOT FOUND"); }

fs.writeFileSync("app/api/projects/route.ts", c, "utf8");
console.log("Final count:", (c.match(/is_bundle_payment/g)||[]).length);
