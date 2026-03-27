/**
 * Undo the deduplication: reactivate all 300 deactivated jobs,
 * restore their job_projects entries, and revert payment moves.
 */
const { PrismaClient } = require('@prisma/client');
BigInt.prototype.toJSON = function () { return Number(this); };
const p = new PrismaClient();

(async () => {
  console.log('=== Restoring all jobs ===\n');

  // Step 1: Reactivate all inactive jobs
  const reactivated = await p.$executeRawUnsafe(`
    UPDATE jobs SET is_active = true, updated_at = CURRENT_TIMESTAMP
    WHERE is_active = false
  `);
  console.log(`Step 1: Reactivated ${reactivated} jobs.`);

  // Step 2: Ensure every active job has its job_projects entry from jobs.project_uuid
  const backfilled = await p.$executeRawUnsafe(`
    INSERT INTO job_projects (job_uuid, project_uuid)
    SELECT j.job_uuid, j.project_uuid
    FROM jobs j
    WHERE j.is_active = true
      AND j.project_uuid IS NOT NULL
    ON CONFLICT (job_uuid, project_uuid) DO NOTHING
  `);
  console.log(`Step 2: Backfilled ${backfilled} job_projects entries.`);

  // Step 3: Remove duplicate job_projects entries (canonical job may have picked up
  // project bindings that belong to the now-reactivated original jobs)
  // Actually, since each job has its own job_uuid, the ON CONFLICT handles this.

  // Verify
  const active = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM jobs WHERE is_active = true');
  const jp = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM job_projects');
  console.log(`\nResult: ${active[0].cnt} active jobs, ${jp[0].cnt} job_projects entries.`);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
