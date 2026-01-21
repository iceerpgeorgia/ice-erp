require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTable() {
  try {
    console.log('\n========================================');
    console.log('  CHECKING SALARY_ACCRUALS TABLE');
    console.log('========================================\n');

    // Count records
    const count = await prisma.salary_accruals.count();
    console.log(`📊 Total records: ${count}\n`);

    if (count > 0) {
      // Get sample records
      const samples = await prisma.salary_accruals.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          counteragents_salary_accruals_counteragent_uuidTocounterагents: {
            select: { name: true, counteragent: true }
          },
          financial_codes: {
            select: { code: true, name: true }
          },
          currencies: {
            select: { code: true, name: true }
          }
        }
      });

      console.log('📋 Sample records:\n');
      samples.forEach((record, index) => {
        console.log(`${index + 1}. ID: ${record.id}`);
        console.log(`   Payment ID: ${record.payment_id}`);
        console.log(`   Employee: ${record.counteragents_salary_accruals_counteragent_uuidTocounterагents?.counteragent || 'N/A'}`);
        console.log(`   Salary Month: ${record.salary_month?.toISOString().split('T')[0]}`);
        console.log(`   Net Sum: ${record.net_sum}`);
        console.log(`   Surplus Insurance: ${record.surplus_insurance || 0}`);
        console.log(`   Financial Code: ${record.financial_codes?.code || 'N/A'}`);
        console.log(`   Currency: ${record.currencies?.code || 'N/A'}`);
        console.log();
      });

      // Check for duplicates by payment_id
      const duplicates = await prisma.$queryRaw`
        SELECT payment_id, COUNT(*) as count
        FROM salary_accruals
        GROUP BY payment_id
        HAVING COUNT(*) > 1
        LIMIT 10
      `;

      if (duplicates.length > 0) {
        console.log('⚠️  DUPLICATE PAYMENT_IDs FOUND:\n');
        duplicates.forEach(dup => {
          console.log(`   ${dup.payment_id}: ${dup.count} records`);
        });
        console.log();
      } else {
        console.log('✅ No duplicate payment_ids found\n');
      }
    } else {
      console.log('ℹ️  Table is empty - ready for import\n');
    }

    // Check schema structure
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'salary_accruals'
      ORDER BY ordinal_position
    `;

    console.log('📐 Table structure:\n');
    tableInfo.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(required)'}`);
    });

    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
