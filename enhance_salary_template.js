require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function enhanceTemplate() {
  try {
    console.log('\n========================================');
    console.log('  ENHANCING SALARY TEMPLATE');
    console.log('========================================\n');

    // Get currency UUIDs for GEL and USD
    console.log('🔍 Looking up currency UUIDs...');
    const currencies = await prisma.currencies.findMany({
      where: { 
        code: { in: ['GEL', 'USD'] }
      }
    });

    const currencyMap = {};
    currencies.forEach(c => {
      currencyMap[c.code] = c.uuid;
    });

    if (!currencyMap['GEL'] || !currencyMap['USD']) {
      console.error('❌ Required currencies not found in database!');
      console.error(`   GEL: ${currencyMap['GEL'] ? '✅' : '❌'}`);
      console.error(`   USD: ${currencyMap['USD'] ? '✅' : '❌'}`);
      process.exit(1);
    }

    console.log(`   ✅ Found GEL: ${currencyMap['GEL']}`);
    console.log(`   ✅ Found USD: ${currencyMap['USD']}\n`);

    // Read existing template
    console.log('📖 Reading existing template...');
    const workbook = XLSX.readFile('templates/salary_accruals_import_template.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`   Found ${data.length} existing records\n`);

    // Enhance each record
    console.log('✨ Enhancing records...');
    const enhanced = data.map(row => {
      const currencyCode = row.nominal_currency_uuid; // This is currently "GEL" or "USD" text
      const currencyUuid = currencyMap[currencyCode];
      
      if (!currencyUuid) {
        console.warn(`⚠️  Unknown currency code: ${currencyCode} in payment_id ${row.payment_id}`);
      }
      
      return {
        uuid: uuidv4(), // Generate new UUID for each record
        counteragent_uuid: row.counteragent_uuid,
        financial_code_uuid: row.financial_code_uuid,
        nominal_currency_uuid: currencyUuid, // Convert currency code to UUID
        payment_id: row.payment_id,
        salary_month: row.salary_month, // Keep as-is (Excel serial or date)
        net_sum: row.net_sum,
        surplus_insurance: row.surplus_insurance || null,
        deducted_insurance: row.deducted_insurance || null,
        deducted_fitness: row.deducted_fitness || null,
        deducted_fine: row.deducted_fine || null,
        created_by: 'import',
        updated_by: 'import'
      };
    });

    console.log(`   ✅ Enhanced ${enhanced.length} records\n`);
    
    // Show currency distribution
    const gelCount = enhanced.filter(r => r.nominal_currency_uuid === currencyMap['GEL']).length;
    const usdCount = enhanced.filter(r => r.nominal_currency_uuid === currencyMap['USD']).length;
    console.log(`   Currency distribution:`);
    console.log(`     GEL: ${gelCount} records`);
    console.log(`     USD: ${usdCount} records\n`);

    // Show sample
    console.log('📋 Sample enhanced record:\n');
    const sample = enhanced[0];
    Object.entries(sample).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log();

    // Write enhanced template
    console.log('💾 Writing enhanced template...');
    const newSheet = XLSX.utils.json_to_sheet(enhanced);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, 'Salary Accruals');
    
    // Backup old template
    const fs = require('fs');
    if (fs.existsSync('templates/salary_accruals_import_template.xlsx')) {
      fs.copyFileSync(
        'templates/salary_accruals_import_template.xlsx',
        'templates/salary_accruals_import_template.xlsx.backup'
      );
      console.log('   ✅ Backup created: salary_accruals_import_template.xlsx.backup');
    }
    
    XLSX.writeFile(newWorkbook, 'templates/salary_accruals_import_template.xlsx');
    console.log('   ✅ Enhanced template saved\n');

    console.log('========================================');
    console.log('✅ TEMPLATE ENHANCED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`\n📊 Summary:`);
    console.log(`   Records processed: ${enhanced.length}`);
    console.log(`   UUIDs generated: ${enhanced.length}`);
    console.log(`   GEL currency UUID: ${currencyMap['GEL']}`);
    console.log(`   USD currency UUID: ${currencyMap['USD']}`);
    console.log(`   Created/Updated by: import`);
    console.log(`\n💡 Original template backed up as:`);
    console.log(`   salary_accruals_import_template.xlsx.backup\n`);

  } catch (error) {
    console.error('\n❌ Enhancement failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

enhanceTemplate();
