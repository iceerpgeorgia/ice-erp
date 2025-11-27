// scripts/import_projects.js
// Usage:
//   node scripts/import_projects.js ./projects.xlsx
//   node scripts/import_projects.js --sheet-name "Projects" ./projects.xlsx
//
// Accepts both friendly headers and DB field names
// Requires: xlsx, @prisma/client

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Friendly → DB field mapping
const FIELD_MAP = {
  project_uuid: ["project_uuid", "Project UUID", "UUID"],
  counteragent_uuid: ["counteragent_uuid", "Counteragent UUID", "Client UUID"],
  project_name: ["project_name", "Project Name", "Name"],
  financial_code_uuid: ["financial_code_uuid", "Financial Code UUID", "Code UUID"],
  date: ["date", "Date", "Project Date"],
  value: ["value", "Value", "Amount"],
  currency_uuid: ["currency_uuid", "Currency UUID"],
  state_uuid: ["state_uuid", "State UUID", "Status UUID"],
  oris_1630: ["oris_1630", "ORIS 1630", "ORIS"],
  contract_no: ["contract_no", "Contract Number", "Contract No"],
  project_index: ["project_index", "Project Index", "Index"],
  employees: ["employees", "Employees", "Employee UUIDs"], // Comma-separated UUIDs
};

/**
 * Normalize header to DB field name
 */
function normalizeHeader(header) {
  const trimmed = (header || "").trim();
  for (const [dbField, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(alias => alias.toLowerCase() === trimmed.toLowerCase())) {
      return dbField;
    }
  }
  return null;
}

/**
 * Parse date from various formats
 */
function parseDate(val) {
  if (!val) return null;
  
  // If it's already a Date object
  if (val instanceof Date) return val;
  
  // If it's a string
  if (typeof val === "string") {
    const parsed = new Date(val);
    return isNaN(parsed) ? null : parsed;
  }
  
  // Excel serial date number
  if (typeof val === "number") {
    return XLSX.SSF.parse_date_code(val);
  }
  
  return null;
}

/**
 * Parse decimal value
 */
function parseDecimal(val) {
  if (!val) return null;
  const num = typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : val;
  return isNaN(num) ? null : num;
}

/**
 * Parse UUID, ensure valid format
 */
function parseUUID(val) {
  if (!val) return null;
  const str = String(val).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str) ? str : null;
}

/**
 * Parse employees - comma-separated UUIDs
 */
function parseEmployees(val) {
  if (!val) return [];
  const str = String(val).trim();
  return str
    .split(",")
    .map(uuid => parseUUID(uuid))
    .filter(uuid => uuid !== null);
}

/**
 * Read Excel file and parse rows
 */
function readExcelFile(filePath, sheetName = null) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = sheetName 
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];
  
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName || workbook.SheetNames[0]}`);
  }
  
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  // Normalize headers
  const normalized = rawData.map(row => {
    const norm = {};
    for (const [key, val] of Object.entries(row)) {
      const dbField = normalizeHeader(key);
      if (dbField) norm[dbField] = val;
    }
    return norm;
  });
  
  return normalized;
}

/**
 * Validate required fields
 */
function validateRow(row, rowNum) {
  const errors = [];
  
  // Required fields
  if (!parseUUID(row.counteragent_uuid)) {
    errors.push("counteragent_uuid is required and must be valid UUID");
  }
  if (!row.project_name?.trim()) {
    errors.push("project_name is required");
  }
  if (!parseUUID(row.financial_code_uuid)) {
    errors.push("financial_code_uuid is required and must be valid UUID");
  }
  if (!parseDate(row.date)) {
    errors.push("date is required and must be valid date");
  }
  if (!parseDecimal(row.value)) {
    errors.push("value is required and must be valid number");
  }
  if (!parseUUID(row.currency_uuid)) {
    errors.push("currency_uuid is required and must be valid UUID");
  }
  if (!parseUUID(row.state_uuid)) {
    errors.push("state_uuid is required and must be valid UUID");
  }
  
  if (errors.length > 0) {
    return { valid: false, errors: `Row ${rowNum}: ${errors.join(", ")}` };
  }
  
  return { valid: true };
}

/**
 * Transform row to database format
 */
function transformRow(row) {
  return {
    project_uuid: parseUUID(row.project_uuid) || undefined, // Let DB generate if not provided
    counteragent_uuid: parseUUID(row.counteragent_uuid),
    project_name: row.project_name?.trim(),
    financial_code_uuid: parseUUID(row.financial_code_uuid),
    date: parseDate(row.date),
    value: parseDecimal(row.value),
    currency_uuid: parseUUID(row.currency_uuid),
    state_uuid: parseUUID(row.state_uuid),
    oris_1630: row.oris_1630?.trim() || null,
    contract_no: row.contract_no?.trim() || null,
    project_index: row.project_index?.trim() || null,
    employees: parseEmployees(row.employees),
    updated_at: new Date(),
  };
}

/**
 * Import a single project
 */
async function importProject(data, index) {
  const { employees, ...projectData } = data;
  
  try {
    // Check if project already exists (by UUID if provided)
    let project;
    if (projectData.project_uuid) {
      project = await prisma.projects.findUnique({
        where: { project_uuid: projectData.project_uuid }
      });
    }
    
    if (project) {
      // Update existing project
      project = await prisma.projects.update({
        where: { project_uuid: projectData.project_uuid },
        data: projectData
      });
      console.log(`✓ Updated project ${index}: ${projectData.project_name}`);
    } else {
      // Create new project
      project = await prisma.projects.create({
        data: projectData
      });
      console.log(`✓ Created project ${index}: ${projectData.project_name}`);
    }
    
    // Handle employees
    if (employees && employees.length > 0) {
      // Delete existing employee assignments
      await prisma.project_employees.deleteMany({
        where: { project_uuid: project.project_uuid }
      });
      
      // Create new assignments
      for (const employeeUuid of employees) {
        await prisma.project_employees.create({
          data: {
            project_uuid: project.project_uuid,
            employee_uuid: employeeUuid
          }
        });
      }
      console.log(`  ├─ Added ${employees.length} employee(s)`);
    }
    
    return { success: true, project };
  } catch (error) {
    console.error(`✗ Failed to import project ${index}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
async function importProjects(filePath, options = {}) {
  console.log(`📂 Reading file: ${filePath}`);
  
  const rows = readExcelFile(filePath, options.sheetName);
  console.log(`📊 Found ${rows.length} rows\n`);
  
  // Validate all rows first
  console.log("🔍 Validating rows...");
  const validationErrors = [];
  const validRows = [];
  
  rows.forEach((row, idx) => {
    const validation = validateRow(row, idx + 2); // +2 for header row and 1-based
    if (validation.valid) {
      validRows.push(transformRow(row));
    } else {
      validationErrors.push(validation.errors);
    }
  });
  
  if (validationErrors.length > 0) {
    console.error("\n❌ Validation errors:");
    validationErrors.forEach(err => console.error(`  ${err}`));
    console.error(`\n${validationErrors.length} row(s) with errors, ${validRows.length} valid row(s)`);
    
    if (validRows.length === 0) {
      console.error("\nNo valid rows to import. Exiting.");
      return;
    }
    
    console.log("\n⚠️  Continuing with valid rows only...\n");
  } else {
    console.log("✓ All rows valid\n");
  }
  
  // Import valid rows
  console.log(`🔄 Importing ${validRows.length} projects...\n`);
  
  let imported = 0;
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < validRows.length; i++) {
    const result = await importProject(validRows[i], i + 1);
    if (result.success) {
      if (validRows[i].project_uuid) updated++;
      else imported++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n✅ Import complete:`);
  console.log(`   Created: ${imported}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${imported + updated} / ${rows.length}`);
}

/**
 * Generate Excel template
 */
function generateTemplate(outputPath) {
  const headers = [
    "Project UUID",
    "Counteragent UUID",
    "Project Name",
    "Financial Code UUID",
    "Date",
    "Value",
    "Currency UUID",
    "State UUID",
    "ORIS 1630",
    "Contract Number",
    "Project Index",
    "Employees"
  ];
  
  const sampleData = [
    {
      "Project UUID": "leave-empty-for-new",
      "Counteragent UUID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "Project Name": "Example Project",
      "Financial Code UUID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "Date": "2025-01-01",
      "Value": "10000.50",
      "Currency UUID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "State UUID": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "ORIS 1630": "optional",
      "Contract Number": "optional",
      "Project Index": "optional",
      "Employees": "uuid1,uuid2,uuid3 (comma-separated)"
    }
  ];
  
  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Projects");
  
  XLSX.writeFile(workbook, outputPath);
  console.log(`✓ Template created: ${outputPath}`);
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes("--help") || args.length === 0) {
    console.log(`
Usage:
  node scripts/import_projects.js <file.xlsx>
  node scripts/import_projects.js --sheet-name "SheetName" <file.xlsx>
  node scripts/import_projects.js --template output.xlsx

Options:
  --sheet-name <name>  Specify which sheet to read (default: first sheet)
  --template <file>    Generate Excel template
  --help               Show this help
    `);
    return;
  }
  
  if (args.includes("--template")) {
    const idx = args.indexOf("--template");
    const outputPath = args[idx + 1] || "projects_template.xlsx";
    generateTemplate(outputPath);
    return;
  }
  
  const filePath = args[args.length - 1];
  const sheetNameIdx = args.indexOf("--sheet-name");
  const sheetName = sheetNameIdx !== -1 ? args[sheetNameIdx + 1] : null;
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  
  try {
    await importProjects(filePath, { sheetName });
  } catch (error) {
    console.error(`❌ Import failed:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { importProjects, generateTemplate };
