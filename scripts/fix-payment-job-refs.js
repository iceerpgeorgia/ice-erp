/**
 * Check if payments reference job_uuids that no longer map to the correct project.
 * During deduplication, payments were moved from duplicate job_uuids to canonical ones.
 * Now that all jobs are restored, we need to re-link payments to the correct job_uuid
 * (the one that shares the same project_uuid as the payment).
 */
const { PrismaClient } = require('@prisma/client');
BigInt.prototype.toJSON = function () { return Number(this); };
const p = new PrismaClient();

(async () => {
  // Find payments where job_uuid doesn't match any job with the same project_uuid
  const mismatches = await p.$queryRawUnsafe(`
    SELECT COUNT(*)::int as cnt
    FROM payments pay
    WHERE pay.job_uuid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.job_uuid = pay.job_uuid
          AND j.project_uuid = pay.project_uuid
          AND j.is_active = true
      )
  `);
  console.log('Payments with mismatched job_uuid:', mismatches[0].cnt);

  if (mismatches[0].cnt > 0) {
    // Fix: re-link to the correct job (same project + same job_name)
    const fixed = await p.$executeRawUnsafe(`
      UPDATE payments pay
      SET job_uuid = correct_job.job_uuid, updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT DISTINCT ON (pay2.id) pay2.id as payment_id, j2.job_uuid
        FROM payments pay2
        JOIN jobs j_old ON j_old.job_uuid = pay2.job_uuid
        JOIN jobs j2 ON j2.project_uuid = pay2.project_uuid
          AND lower(j2.job_name) = lower(j_old.job_name)
          AND j2.is_active = true
        WHERE pay2.job_uuid IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM jobs j3
            WHERE j3.job_uuid = pay2.job_uuid
              AND j3.project_uuid = pay2.project_uuid
              AND j3.is_active = true
          )
        ORDER BY pay2.id, j2.id
      ) correct_job
      WHERE pay.id = correct_job.payment_id
    `);
    console.log('Fixed', fixed, 'payment job_uuid references.');
  }

  // Verify
  const remaining = await p.$queryRawUnsafe(`
    SELECT COUNT(*)::int as cnt
    FROM payments pay
    WHERE pay.job_uuid IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.job_uuid = pay.job_uuid
          AND j.project_uuid = pay.project_uuid
          AND j.is_active = true
      )
  `);
  console.log('Remaining mismatches:', remaining[0].cnt);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
