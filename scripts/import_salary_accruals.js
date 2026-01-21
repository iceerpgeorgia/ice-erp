// scripts/import_salary_accruals.js
// Usage: node scripts/import_salary_accruals.js <file.xlsx> [--sheet=Sheet1] [--dry-run]

const fs = require("fs");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SHEET_ARG = args.find((a) => a.startsWith("--sheet="));
const FILE_ARG = args.find((a) => !a.startsWith("--"));

if (!FILE_ARG) {
  console.log(
    "Usage:\n  node scripts/import_salary_accruals.js <file.xlsx> [--sheet=Sheet1] [--dry-run]"
  );
  process.exit(0);
}

const file = FILE_ARG;
const SHEET = SHEET_ARG ? SHEET_ARG.split("=")[1] : "salary_accruals";

// Helper function to generate payment_id
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

function parseDate(any) {
  if (any == null || any === "") return null;
  if (any instanceof Date) return any;
  if (typeof any === "number") {
    const d = XLSX.SSF.parse_date_code(any);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(any).trim();
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  const m = s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseDecimal(value) {
  if (value == null || value === "") return 0;
  const num = parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

async function main() {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Importing Salary Accruals from: ${file}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`${"=".repeat(60)}\n`);

  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets[SHEET] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) {
    console.error("No worksheet found.");
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`Found ${rows.length} rows\n`);

  let created = 0,
    updated = 0,
    skipped = 0,
    errors = 0;

  // Parse all rows first
  const validRecords = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2;

    try {
      const uuid = row.uuid || row.UUID;
      const counteragent_uuid = row.counteragent_uuid || row["Counteragent UUID"];
      const financial_code_uuid = row.financial_code_uuid || row["Financial Code UUID"];
      const nominal_currency_uuid = row.nominal_currency_uuid || row["Currency UUID"];
      const salary_month = parseDate(row.salary_month || row["Salary Month"]);
      const net_sum = parseDecimal(row.net_sum || row["Net Sum"]);
      const surplus_insurance = parseDecimal(row.surplus_insurance || row["Surplus Insurance"]);
      const deducted_insurance = parseDecimal(row.deducted_insurance || row["Deducted Insurance"]);
      const deducted_fitness = parseDecimal(row.deducted_fitness || row["Deducted Fitness"]);
      const deducted_fine = parseDecimal(row.deducted_fine || row["Deducted Fine"]);
      const created_by = row.created_by || row["Created By"] || "import_script";
      const updated_by = row.updated_by || row["Updated By"] || "import_script";

      if (!counteragent_uuid || !financial_code_uuid || !nominal_currency_uuid || !salary_month) {
        console.error(`Row ${rowNum}: Missing required fields`);
        errors++;
        continue;
      }

      const payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salary_month);

      validRecords.push({
        uuid,
        counteragent_uuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        salary_month,
        net_sum,
        surplus_insurance: surplus_insurance || null,
        deducted_insurance: deducted_insurance || null,
        deducted_fitness: deducted_fitness || null,
        deducted_fine: deducted_fine || null,
        created_by,
        updated_by,
        updated_at: new Date(),
        rowNum,
      });
    } catch (error) {
      console.error(`Row ${rowNum}: Parse error - ${error.message}`);
      errors++;
    }
  }

  console.log(`Parsed ${validRecords.length} valid records\n`);

  if (DRY_RUN) {
    console.log("DRY RUN - No changes made");
    skipped = validRecords.length;
  } else {
    // BATCH INSERT - Much faster!
    console.log("🚀 Starting BATCH INSERT...");
    const BATCH_SIZE = 500;
    
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const batch = validRecords.slice(i, i + BATCH_SIZE);
      const batchData = batch.map(r => {
        const { rowNum, ...data } = r;
        return r.uuid ? data : { ...data, uuid: undefined };
      });
      
      try {
        const result = await prisma.salary_accruals.createMany({
          data: batchData,
          skipDuplicates: true,
        });
        created += result.count;
        console.log(`  ✅ Batch ${Math.floor(i/BATCH_SIZE) + 1}: Inserted ${result.count}/${batch.length} records`);
      } catch (error) {
        console.error(`  ❌ Batch ${Math.floor(i/BATCH_SIZE) + 1} error: ${error.message}`);
        errors += batch.length;
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Import Summary:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);
  console.log(`${"=".repeat(60)}\n`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  prisma.$disconnect();
  process.exit(1);
});
