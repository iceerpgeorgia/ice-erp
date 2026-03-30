const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find true duplicates: same job_name + brand + insider + project but different job_uuid
  const dupes = await p.$queryRawUnsafe(`
    SELECT 
      j.job_name, b.name as brand_name, jp.project_uuid, pr.project_name,
      j.job_uuid::text as job_uuid, j.brand_uuid, j.insider_uuid
    FROM jobs j
    JOIN job_projects jp ON j.job_uuid = jp.job_uuid
    JOIN projects pr ON jp.project_uuid = pr.project_uuid
    LEFT JOIN brands b ON j.brand_uuid = b.uuid
    WHERE j.is_active = true
    AND (j.job_name, j.brand_uuid, j.insider_uuid, jp.project_uuid) IN (
      SELECT j2.job_name, j2.brand_uuid, j2.insider_uuid, jp2.project_uuid
      FROM jobs j2
      JOIN job_projects jp2 ON j2.job_uuid = jp2.job_uuid
      WHERE j2.is_active = true
      GROUP BY j2.job_name, j2.brand_uuid, j2.insider_uuid, jp2.project_uuid
      HAVING count(DISTINCT j2.job_uuid) > 1
    )
    ORDER BY j.job_name, jp.project_uuid
  `);

  // Group by (job_name, brand, project)
  const groups = {};
  for (const d of dupes) {
    const key = `${d.job_name}|${d.brand_name}|${d.project_uuid}`;
    if (!groups[key]) groups[key] = { ...d, jobs: [] };
    groups[key].jobs.push(d.job_uuid);
  }

  let removedBindings = 0;
  let deactivatedJobs = 0;

  for (const [key, group] of Object.entries(groups)) {
    console.log(`\n--- ${group.job_name} | ${group.brand_name} | ${group.project_name} ---`);

    // For each job in the group, check payments and total bindings
    const jobDetails = [];
    for (const uuid of group.jobs) {
      const [payResult] = await p.$queryRawUnsafe(
        `SELECT count(*) as cnt FROM payments WHERE job_uuid = $1::uuid`, uuid
      );
      const [bindResult] = await p.$queryRawUnsafe(
        `SELECT count(*) as cnt FROM job_projects WHERE job_uuid = $1::uuid`, uuid
      );
      jobDetails.push({
        uuid,
        payments: Number(payResult.cnt),
        totalBindings: Number(bindResult.cnt)
      });
    }

    // Sort: keep the one with payments, remove the one without
    const toKeep = jobDetails.filter(j => j.payments > 0);
    const toRemove = jobDetails.filter(j => j.payments === 0);

    if (toKeep.length === 0) {
      console.log('  WARNING: No job has payments! Skipping group.');
      continue;
    }
    if (toRemove.length === 0) {
      console.log('  WARNING: All jobs have payments! Skipping group (manual review needed).');
      continue;
    }

    for (const keeper of toKeep) {
      console.log(`  KEEP: ${keeper.uuid} (${keeper.payments} payments, ${keeper.totalBindings} bindings)`);
    }

    for (const rm of toRemove) {
      console.log(`  REMOVE: ${rm.uuid} (0 payments, ${rm.totalBindings} total bindings)`);

      // Remove the duplicate binding to this specific project
      const delResult = await p.$queryRawUnsafe(
        `DELETE FROM job_projects WHERE job_uuid = $1::uuid AND project_uuid = $2::uuid RETURNING *`,
        rm.uuid, group.project_uuid
      );
      console.log(`    Deleted ${delResult.length} binding(s) for project ${group.project_name}`);
      removedBindings += delResult.length;

      // Check remaining bindings
      const [remaining] = await p.$queryRawUnsafe(
        `SELECT count(*) as cnt FROM job_projects WHERE job_uuid = $1::uuid`, rm.uuid
      );
      const remainingCount = Number(remaining.cnt);

      if (remainingCount === 0) {
        // No more bindings — deactivate the job entirely
        await p.$queryRawUnsafe(
          `UPDATE jobs SET is_active = false WHERE job_uuid = $1::uuid`, rm.uuid
        );
        console.log(`    Deactivated job (no remaining bindings)`);
        deactivatedJobs++;
      } else {
        console.log(`    Job still has ${remainingCount} other binding(s) — kept active`);
      }
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Removed ${removedBindings} duplicate binding(s)`);
  console.log(`Deactivated ${deactivatedJobs} job(s)`);

  await p.$disconnect();
})();
