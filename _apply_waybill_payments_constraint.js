/**
 * Migration: Relax payments composite unique constraint to allow waybill-derived payments
 *
 * Why: Multiple waybill-derived payments for the same (project, counteragent, FC) group
 * would violate the existing ALL-rows unique constraint. We replace it with a partial
 * unique index that only applies to non-waybill-derived payments.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Step 1: Dropping old composite unique constraint...');
  await prisma.$executeRawUnsafe(
    `ALTER TABLE payments DROP CONSTRAINT IF EXISTS "payments_project_uuid_counteragent_uuid_financial_code_uu_key"`
  );
  console.log('  Done.');

  console.log('Step 2: Creating partial unique index (WHERE waybill_derived = FALSE)...');
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS payments_composite_unique_non_waybill
     ON payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid)
     WHERE waybill_derived = FALSE`
  );
  console.log('  Done.');

  console.log('Migration complete.');
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
