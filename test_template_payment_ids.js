// Test if template payment_ids match the algorithm
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generatePaymentId(counteragentUuid, financialCodeUuid, salaryMonth) {
  const extractChars = (uuid) => {
    const cleaned = uuid.replace(/-/g, '');
    return cleaned[1] + cleaned[3] + cleaned[5] + cleaned[7] + cleaned[9] + cleaned[11];
  };

  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financialCodeUuid);

  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;

  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

function parseDate(any) {
  if (any == null || any === '') return null;
  if (any instanceof Date) return any;
  if (typeof any === 'number') {
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

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('TESTING TEMPLATE PAYMENT_ID ALGORITHM CONSISTENCY');
  console.log('='.repeat(70) + '\n');

  // Read template
  const file = 'templates/salary_accruals_import_template.xlsx';
  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets['salary_accruals'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

  console.log(`📄 Loaded ${rows.length} rows from template\n`);

  let matches = 0;
  let mismatches = 0;
  const mismatchExamples = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const template_payment_id = row.payment_id || row['Payment ID'];
    const counteragent_uuid = row.counteragent_uuid || row['Counteragent UUID'];
    const financial_code_uuid = row.financial_code_uuid || row['Financial Code UUID'];
    const salary_month = parseDate(row.salary_month || row['Salary Month']);

    if (!counteragent_uuid || !financial_code_uuid || !salary_month) {
      console.log(`⚠️  Row ${rowNum}: Missing required fields, skipping`);
      continue;
    }

    const calculated_payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salary_month);

    if (template_payment_id === calculated_payment_id) {
      matches++;
    } else {
      mismatches++;
      if (mismatchExamples.length < 10) {
        mismatchExamples.push({
          rowNum,
          template: template_payment_id,
          calculated: calculated_payment_id,
          counteragent_uuid,
          financial_code_uuid,
          salary_month: salary_month.toISOString().split('T')[0]
        });
      }
    }
  }

  console.log('📊 RESULTS:\n');
  console.log(`  ✅ Matches:    ${matches}`);
  console.log(`  ❌ Mismatches: ${mismatches}`);
  console.log(`  📈 Success Rate: ${((matches / (matches + mismatches)) * 100).toFixed(2)}%\n`);

  if (mismatches > 0) {
    console.log('⚠️  MISMATCH EXAMPLES (first 10):\n');
    console.log('='.repeat(70));
    mismatchExamples.forEach(ex => {
      console.log(`Row ${ex.rowNum}:`);
      console.log(`  Template:   ${ex.template}`);
      console.log(`  Calculated: ${ex.calculated}`);
      console.log(`  Counteragent: ${ex.counteragent_uuid}`);
      console.log(`  Financial:    ${ex.financial_code_uuid}`);
      console.log(`  Month:        ${ex.salary_month}`);
      console.log('');
    });
    console.log('='.repeat(70) + '\n');
  } else {
    console.log('✅ ALL PAYMENT IDs IN TEMPLATE MATCH THE ALGORITHM!\n');
  }

  // Now check database
  console.log('🔍 Checking database records...\n');
  
  const dbRecords = await prisma.salary_accruals.findMany({
    select: {
      payment_id: true,
      counteragent_uuid: true,
      financial_code_uuid: true,
      salary_month: true
    },
    take: 10
  });

  console.log('📊 Sample Database Records:\n');
  let dbMatches = 0;
  let dbMismatches = 0;

  for (const record of dbRecords) {
    const calculated = generatePaymentId(
      record.counteragent_uuid,
      record.financial_code_uuid,
      record.salary_month
    );

    const match = record.payment_id === calculated;
    if (match) {
      dbMatches++;
      console.log(`  ✅ ${record.payment_id}`);
    } else {
      dbMismatches++;
      console.log(`  ❌ DB:         ${record.payment_id}`);
      console.log(`     Calculated: ${calculated}`);
    }
  }

  console.log(`\n📊 Database Sample: ${dbMatches} matches, ${dbMismatches} mismatches\n`);
  console.log('='.repeat(70) + '\n');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
