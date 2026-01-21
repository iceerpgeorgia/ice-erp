#!/usr/bin/env node

// Test the FIXED payment ID generation
function generatePaymentId(counteragentUuid, financialCodeUuid, salaryMonth) {
  // Extract characters at positions 2, 4, 6, 8, 10, 12 (1-indexed Excel MID)
  // This corresponds to indices 1, 3, 5, 7, 9, 11 (0-indexed) from UUID WITH hyphens
  const extractChars = (uuid) => {
    // Excel MID works on UUID WITH hyphens, so we DON'T remove them
    return uuid[1] + uuid[3] + uuid[5] + uuid[7] + uuid[9] + uuid[11];
  };

  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);

  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

const counteragentUuid = "5BEEA027-BF57-4C93-AABC-21FD42F223A5";
const financialCodeUuid = "319B2A70-B446-41F6-9F39-A3DFB1082786";
const salaryMonth = new Date("2023-01-01");

const result = generatePaymentId(counteragentUuid, financialCodeUuid, salaryMonth);

console.log("\n" + "=".repeat(80));
console.log("FIXED PAYMENT ID GENERATION - VERIFICATION");
console.log("=".repeat(80) + "\n");

console.log("Input:");
console.log(`  Counteragent UUID: ${counteragentUuid}`);
console.log(`  Financial UUID:    ${financialCodeUuid}`);
console.log(`  Salary Month:      January 2023\n`);

console.log("Generated Payment ID:");
console.log(`  ${result}\n`);

console.log("Expected Payment ID:");
console.log(`  NP_BE07B5_NJ_1BA0B4_PRL012023\n`);

const match = result.toUpperCase() === "NP_BE07B5_NJ_1BA0B4_PRL012023";
console.log(`Match: ${match ? '✅ SUCCESS' : '❌ FAILED'}\n`);

if (!match) {
  console.log("ERROR: Payment ID does not match!");
  process.exit(1);
}

console.log("=".repeat(80));
console.log("✅ FIX VERIFIED - Payment ID generation is now correct!");
console.log("=".repeat(80) + "\n");
