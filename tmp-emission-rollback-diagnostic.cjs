const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    await prisma.$executeRawUnsafe('BEGIN');
    await prisma.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await prisma.$executeRawUnsafe("SET LOCAL statement_timeout = '20s'");
    console.log('Attempting trigger disable...');
    await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" DISABLE TRIGGER prevent_emitted_payments_jobs_update');
    console.log('Trigger disable succeeded.');
    await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" ENABLE TRIGGER prevent_emitted_payments_jobs_update');
    console.log('Trigger re-enable succeeded.');
    await prisma.$executeRawUnsafe('ROLLBACK');
    await prisma.$disconnect();
  } catch (e) {
    console.error('DIAG_ERROR:', e?.message || e);
    try { await prisma.$executeRawUnsafe('ROLLBACK'); } catch {}
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
