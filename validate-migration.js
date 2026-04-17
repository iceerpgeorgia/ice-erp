// Pre-Migration Validation Script
// Run this first to check your Excel file before actual migration

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');

const prisma = new PrismaClient();

const COLUMN_MAPPING = {
  fileName: 'file_name',
  gdriveUrl: 'gdrive_url',
  projectName: 'project_name',
  projectCode: 'project_code',
  documentType: 'document_type',
  documentDate: 'document_date',
  documentNo: 'document_no',
  documentValue: 'document_value',
  currencyCode: 'currency_code',
};

async function validateExcel(excelPath) {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Pre-Migration Validation                           ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ File not found: ${excelPath}`);
    return false;
  }
  
  // Read Excel
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`📊 Excel file: ${excelPath}`);
  console.log(`📄 Sheet: ${sheetName}`);
  console.log(`📝 Rows: ${rows.length}`);
  console.log('');
  
  // Check columns
  console.log('Column Validation:');
  const missingColumns = [];
  const col = COLUMN_MAPPING;
  
  if (rows.length > 0) {
    const firstRow = rows[0];
    
    // Check required columns
    if (!firstRow[col.fileName]) {
      console.log(`  ❌ Missing required column: ${col.fileName}`);
      missingColumns.push(col.fileName);
    } else {
      console.log(`  ✓ ${col.fileName}`);
    }
    
    if (!firstRow[col.gdriveUrl]) {
      console.log(`  ❌ Missing required column: ${col.gdriveUrl}`);
      missingColumns.push(col.gdriveUrl);
    } else {
      console.log(`  ✓ ${col.gdriveUrl}`);
    }
    
    // Check optional columns
    const optionalCols = [
      col.projectName, col.projectCode, col.documentType, 
      col.documentDate, col.documentNo, col.documentValue, col.currencyCode
    ];
    
    optionalCols.forEach(colName => {
      if (firstRow.hasOwnProperty(colName)) {
        console.log(`  ✓ ${colName} (optional)`);
      } else {
        console.log(`  ⚠ ${colName} (optional, not found)`);
      }
    });
  }
  
  console.log('');
  
  if (missingColumns.length > 0) {
    console.error('❌ Validation failed: Missing required columns');
    return false;
  }
  
  // Load reference data
  console.log('Loading reference data...');
  const [projects, documentTypes, currencies] = await Promise.all([
    prisma.projects.findMany({ select: { project_number: true, project_name: true } }),
    prisma.document_types.findMany({ where: { is_active: true }, select: { name: true } }),
    prisma.currencies.findMany({ where: { is_active: true }, select: { code: true } })
  ]);
  
  console.log(`  ✓ ${projects.length} projects`);
  console.log(`  ✓ ${documentTypes.length} document types`);
  console.log(`  ✓ ${currencies.length} currencies`);
  console.log('');
  
  // Validate data
  const issues = {
    missingFiles: [],
    invalidUrls: [],
    projectNotFound: [],
    documentTypeNotFound: [],
    currencyNotFound: [],
    invalidDates: [],
    invalidValues: []
  };
  
  const projectNames = new Set(projects.map(p => p.project_name?.toLowerCase()).filter(Boolean));
  const projectCodes = new Set(projects.map(p => p.project_number?.toLowerCase()).filter(Boolean));
  const docTypeNames = new Set(documentTypes.map(dt => dt.name.toLowerCase()));
  const currencyCodes = new Set(currencies.map(c => c.code.toLowerCase()));
  
  console.log('Validating rows...');
  
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    
    // Check required fields
    if (!row[col.fileName]) {
      issues.missingFiles.push(rowNum);
    }
    
    if (!row[col.gdriveUrl]) {
      issues.invalidUrls.push({ row: rowNum, reason: 'Missing URL' });
    } else {
      // Validate URL format
      const url = row[col.gdriveUrl];
      if (!url.includes('drive.google.com')) {
        issues.invalidUrls.push({ row: rowNum, reason: 'Not a Google Drive URL' });
      }
    }
    
    // Check project lookup
    const projectIdentifier = row[col.projectName] || row[col.projectCode];
    if (projectIdentifier) {
      const identifier = projectIdentifier.toString().toLowerCase();
      if (!projectNames.has(identifier) && !projectCodes.has(identifier)) {
        issues.projectNotFound.push({ row: rowNum, identifier: projectIdentifier });
      }
    }
    
    // Check document type
    if (row[col.documentType]) {
      const docType = row[col.documentType].toString().toLowerCase();
      if (!docTypeNames.has(docType)) {
        issues.documentTypeNotFound.push({ row: rowNum, type: row[col.documentType] });
      }
    }
    
    // Check currency
    if (row[col.currencyCode]) {
      const currency = row[col.currencyCode].toString().toLowerCase();
      if (!currencyCodes.has(currency)) {
        issues.currencyNotFound.push({ row: rowNum, code: row[col.currencyCode] });
      }
    }
    
    // Check date format
    if (row[col.documentDate]) {
      const date = row[col.documentDate];
      if (typeof date === 'string' && isNaN(Date.parse(date)) && typeof date !== 'number') {
        issues.invalidDates.push({ row: rowNum, date: date });
      }
    }
    
    // Check value is numeric
    if (row[col.documentValue]) {
      const value = row[col.documentValue];
      if (typeof value !== 'number' && isNaN(parseFloat(value))) {
        issues.invalidValues.push({ row: rowNum, value: value });
      }
    }
  });
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Validation Results                                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Report issues
  if (issues.missingFiles.length > 0) {
    hasErrors = true;
    console.log(`\n❌ Missing file_name (${issues.missingFiles.length} rows):`);
    issues.missingFiles.slice(0, 10).forEach(row => console.log(`  Row ${row}`));
    if (issues.missingFiles.length > 10) console.log(`  ... and ${issues.missingFiles.length - 10} more`);
  }
  
  if (issues.invalidUrls.length > 0) {
    hasErrors = true;
    console.log(`\n❌ Invalid URLs (${issues.invalidUrls.length} rows):`);
    issues.invalidUrls.slice(0, 10).forEach(item => console.log(`  Row ${item.row}: ${item.reason}`));
    if (issues.invalidUrls.length > 10) console.log(`  ... and ${issues.invalidUrls.length - 10} more`);
  }
  
  if (issues.projectNotFound.length > 0) {
    hasWarnings = true;
    console.log(`\n⚠️  Projects not found (${issues.projectNotFound.length} rows):`);
    issues.projectNotFound.slice(0, 10).forEach(item => console.log(`  Row ${item.row}: "${item.identifier}"`));
    if (issues.projectNotFound.length > 10) console.log(`  ... and ${issues.projectNotFound.length - 10} more`);
  }
  
  if (issues.documentTypeNotFound.length > 0) {
    hasWarnings = true;
    console.log(`\n⚠️  Document types not found (${issues.documentTypeNotFound.length} rows):`);
    const uniqueTypes = [...new Set(issues.documentTypeNotFound.map(i => i.type))];
    uniqueTypes.forEach(type => console.log(`  "${type}"`));
    console.log(`\n  Available types: ${[...docTypeNames].join(', ')}`);
  }
  
  if (issues.currencyNotFound.length > 0) {
    hasWarnings = true;
    console.log(`\n⚠️  Currencies not found (${issues.currencyNotFound.length} rows):`);
    const uniqueCurrencies = [...new Set(issues.currencyNotFound.map(i => i.code))];
    uniqueCurrencies.forEach(code => console.log(`  "${code}"`));
    console.log(`\n  Available codes: ${[...currencyCodes].map(c => c.toUpperCase()).join(', ')}`);
  }
  
  if (issues.invalidDates.length > 0) {
    hasWarnings = true;
    console.log(`\n⚠️  Invalid dates (${issues.invalidDates.length} rows):`);
    issues.invalidDates.slice(0, 5).forEach(item => console.log(`  Row ${item.row}: "${item.date}"`));
    if (issues.invalidDates.length > 5) console.log(`  ... and ${issues.invalidDates.length - 5} more`);
  }
  
  if (issues.invalidValues.length > 0) {
    hasWarnings = true;
    console.log(`\n⚠️  Invalid values (${issues.invalidValues.length} rows):`);
    issues.invalidValues.slice(0, 5).forEach(item => console.log(`  Row ${item.row}: "${item.value}"`));
    if (issues.invalidValues.length > 5) console.log(`  ... and ${issues.invalidValues.length - 5} more`);
  }
  
  console.log('');
  
  if (!hasErrors && !hasWarnings) {
    console.log('✅ All validation checks passed!');
    console.log('');
    console.log('Ready to migrate. Run:');
    console.log(`  node migrate-gdrive-attachments.js ${excelPath} --dry-run`);
    return true;
  } else if (!hasErrors && hasWarnings) {
    console.log('⚠️  Validation completed with warnings');
    console.log('Warnings will not prevent migration, but data may be incomplete.');
    console.log('');
    console.log('You can proceed with:');
    console.log(`  node migrate-gdrive-attachments.js ${excelPath} --dry-run`);
    return true;
  } else {
    console.log('❌ Validation failed with errors');
    console.log('Fix the errors listed above before running migration.');
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node validate-migration.js <excel-file-path>');
    console.error('');
    console.error('Example: node validate-migration.js attachments.xlsx');
    process.exit(1);
  }
  
  try {
    await validateExcel(args[0]);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
