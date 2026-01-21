require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();

// Helper function to convert Excel serial date to JavaScript Date
function excelDateToJSDate(serial) {
  if (typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

async function importSalaryAccruals() {
  try {
    console.log('\n========================================');
    console.log('  IMPORTING SALARY ACCRUALS');
    console.log('========================================\n');

    // Read template
    console.log('📖 Reading template...');
    const workbook = XLSX.readFile('templates/salary_accruals_import_template.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`   Found ${data.length} records\n`);

    // Check for existing records
    const existingCount = await prisma.salary_accruals.count();
    if (existingCount > 0) {
      console.log(`⚠️  Warning: Table already contains ${existingCount} records`);
      console.log('   This import will ADD new records\n');
    }

    // Prepare records for import
    console.log('📝 Preparing records...');
    const records = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Convert Excel date to JS Date
        let salaryMonth;
        if (typeof row.salary_month === 'number') {
          salaryMonth = excelDateToJSDate(row.salary_month);
        } else {
          salaryMonth = new Date(row.salary_month);
        }

        const record = {
          uuid: row.uuid,
          counteragent_uuid: row.counteragent_uuid,
          financial_code_uuid: row.financial_code_uuid,
          nominal_currency_uuid: row.nominal_currency_uuid,
          payment_id: row.payment_id,
          salary_month: salaryMonth,
          net_sum: parseFloat(row.net_sum) || 0,
          surplus_insurance: row.surplus_insurance ? parseFloat(row.surplus_insurance) : null,
          deducted_insurance: row.deducted_insurance ? parseFloat(row.deducted_insurance) : null,
          deducted_fitness: row.deducted_fitness ? parseFloat(row.deducted_fitness) : null,
          deducted_fine: row.deducted_fine ? parseFloat(row.deducted_fine) : null,
          created_by: row.created_by || 'import',
          updated_by: row.updated_by || 'import',
          created_at: new Date(),
          updated_at: new Date()
        };

        records.push(record);
      } catch (error) {
        errors.push({ row: i + 2, error: error.message, data: row });
      }
    }

    console.log(`   ✅ ${records.length} records prepared`);
    if (errors.length > 0) {
      console.log(`   ❌ ${errors.length} records failed validation\n`);
      console.log('First 5 errors:');
      errors.slice(0, 5).forEach(err => {
        console.log(`   Row ${err.row}: ${err.error}`);
      });
      console.log();
    }

    if (records.length === 0) {
      console.log('❌ No valid records to import');
      return;
    }

    // Import in batches
    console.log(`\n💾 Importing ${records.length} records in batches...`);
    const batchSize = 100;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      try {
        await prisma.salary_accruals.createMany({
          data: batch,
          skipDuplicates: true // Skip if UUID already exists
        });

        imported += batch.length;
        process.stdout.write(`\r   Batch ${batchNum}/${totalBatches}: ${imported}/${records.length} records imported`);
      } catch (error) {
        failed += batch.length;
        console.log(`\n   ❌ Batch ${batchNum} failed: ${error.message}`);
      }
    }

    console.log('\n');

    // Verify import
    const finalCount = await prisma.salary_accruals.count();
    const newRecords = finalCount - existingCount;

    console.log('\n========================================');
    console.log('  IMPORT SUMMARY');
    console.log('========================================');
    console.log(`   Records in template: ${data.length}`);
    console.log(`   Valid records: ${records.length}`);
    console.log(`   Successfully imported: ${imported}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Validation errors: ${errors.length}`);
    console.log(`\n   Previous count: ${existingCount}`);
    console.log(`   Current count: ${finalCount}`);
    console.log(`   New records added: ${newRecords}`);
    console.log('========================================\n');

    if (newRecords > 0) {
      // Show sample imported records
      const samples = await prisma.salary_accruals.findMany({
        take: 3,
        orderBy: { created_at: 'desc' },
        include: {
          counteragents_salary_accruals_counteragent_uuidTocounterагents: {
            select: { counteragent: true }
          },
          financial_codes: {
            select: { code: true }
          }
        }
      });

      console.log('📋 Sample imported records:\n');
      samples.forEach((record, index) => {
        console.log(`${index + 1}. Payment ID: ${record.payment_id}`);
        console.log(`   Employee: ${record.counteragents_salary_accruals_counteragent_uuidTocounterагents?.counteragent || 'N/A'}`);
        console.log(`   Month: ${record.salary_month?.toISOString().split('T')[0]}`);
        console.log(`   Net Sum: ${record.net_sum}`);
        console.log();
      });
    }

    console.log('✅ Import completed!\n');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importSalaryAccruals();
