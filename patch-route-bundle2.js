const fs = require("fs");
let c = fs.readFileSync("app/api/projects/route.ts", "utf8");

// Check if POST duplicate block is still there
const marker = "      if (isBundleFC) {";
const firstIdx = c.indexOf(marker);
const secondIdx = c.indexOf(marker, firstIdx + marker.length);
console.log("firstIdx:", firstIdx, "secondIdx:", secondIdx);

// The INSERT in POST block uses \r\n (CRLF) line endings
// Use a simpler approach: replace the specific column list in the POST INSERT
const oldCols = "currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, updated_at\r\n              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, NOW())";
const newCols = "currency_uuid, payment_id, record_uuid, insider_uuid, is_project_derived, is_bundle_payment, updated_at\r\n              ) VALUES ($1::uuid, $2::uuid, $3::uuid, NULL, false, $4::uuid, '', '', $5::uuid, true, true, NOW())";

if (c.includes(oldCols)) {
  // Replace first occurrence only (the one we want to keep - actually only ONE occurrence since other was already removed)
  c = c.replace(oldCols, newCols);
  console.log("POST cols replaced");
} else {
  console.log("POST cols NOT FOUND - checking variants...");
  // Try with just \n
  const oldColsLF = oldCols.replace(/\r\n/g, "\n");
  console.log("LF variant found:", c.includes(oldColsLF));
}

fs.writeFileSync("app/api/projects/route.ts", c, "utf8");
console.log("Final is_bundle_payment count:", (c.match(/is_bundle_payment/g)||[]).length);
