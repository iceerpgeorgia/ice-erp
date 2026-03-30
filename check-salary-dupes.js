const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Find duplicates in March 2026
    const dupes = await prisma.$queryRawUnsafe(`
      SELECT counteragent_uuid, financial_code_uuid, salary_month, COUNT(*) as cnt,
             ARRAY_AGG(id ORDER BY id) as ids,
             ARRAY_AGG(created_at ORDER BY id) as created_dates
      FROM salary_accruals
      WHERE salary_month >= '2026-03-01' AND salary_month < '2026-04-01'
      GROUP BY counteragent_uuid, financial_code_uuid, salary_month
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT 20
    `);
    console.log('Duplicate groups (counteragent+financial_code+month):', dupes.length);
    dupes.forEach(d => console.log(JSON.stringify({
      cnt: Number(d.cnt),
      ids: d.ids.map(Number),
      created: d.created_dates,
      ca: d.counteragent_uuid,
      fc: d.financial_code_uuid,
    })));

    // Total March records
    const total = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM salary_accruals WHERE salary_month >= '2026-03-01' AND salary_month < '2026-04-01'`);
    console.log('\nTotal March 2026 records:', total[0].cnt.toString());

    // Check if copy was run multiple times
    const byCreatedAt = await prisma.$queryRawUnsafe(`
      SELECT DATE_TRUNC('minute', created_at) as created_minute, COUNT(*) as cnt
      FROM salary_accruals
      WHERE salary_month >= '2026-03-01' AND salary_month < '2026-04-01'
      GROUP BY created_minute
      ORDER BY created_minute
    `);
    console.log('\nRecords by creation time:');
    byCreatedAt.forEach(r => console.log(r.created_minute, ':', Number(r.cnt)));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
