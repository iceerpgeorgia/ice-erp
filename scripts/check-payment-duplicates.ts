import fs from 'fs';
import { config } from 'dotenv';
import { prisma } from '../lib/prisma';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else {
  config();
}

async function main() {
  const paymentIdDupes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT payment_id, COUNT(*) as count
     FROM payments
     GROUP BY payment_id
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC, payment_id ASC`
  );

  const compositeDupes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid, COUNT(*) as count
     FROM payments
     WHERE is_active = true
     GROUP BY project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC`
  );

  console.log(`Duplicate payment_id rows: ${paymentIdDupes.length}`);
  if (paymentIdDupes.length > 0) {
    paymentIdDupes.forEach((row) => {
      console.log(`  ${row.payment_id}: ${row.count}`);
    });
  }

  console.log(`Duplicate composite rows (active): ${compositeDupes.length}`);
  if (compositeDupes.length > 0) {
    compositeDupes.forEach((row) => {
      console.log(
        `  project=${row.project_uuid ?? 'null'} counteragent=${row.counteragent_uuid} financial_code=${row.financial_code_uuid} job=${row.job_uuid ?? 'null'} income_tax=${row.income_tax} currency=${row.currency_uuid} count=${row.count}`
      );
    });
  }
}

main()
  .catch((error) => {
    console.error('Failed to check duplicates:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });