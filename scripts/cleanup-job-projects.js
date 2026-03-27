/**
 * Clean up job_projects: each job should have exactly the entry matching its own project_uuid.
 * Remove entries where the project_uuid doesn't match the job's own project_uuid.
 */
const { PrismaClient } = require('@prisma/client');
BigInt.prototype.toJSON = function () { return Number(this); };
const p = new PrismaClient();

(async () => {
  console.log('=== Cleaning job_projects ===\n');

  // Delete all job_projects, re-insert from jobs.project_uuid (canonical source)
  const deleted = await p.$executeRawUnsafe(`DELETE FROM job_projects`);
  console.log(`Deleted ${deleted} old job_projects entries.`);

  const inserted = await p.$executeRawUnsafe(`
    INSERT INTO job_projects (job_uuid, project_uuid)
    SELECT j.job_uuid, j.project_uuid
    FROM jobs j
    WHERE j.is_active = true
      AND j.project_uuid IS NOT NULL
    ON CONFLICT (job_uuid, project_uuid) DO NOTHING
  `);
  console.log(`Inserted ${inserted} job_projects entries from jobs.project_uuid.`);

  // Verify
  const active = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM jobs WHERE is_active = true');
  const jp = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM job_projects');
  console.log(`\nResult: ${active[0].cnt} active jobs, ${jp[0].cnt} job_projects entries.`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
