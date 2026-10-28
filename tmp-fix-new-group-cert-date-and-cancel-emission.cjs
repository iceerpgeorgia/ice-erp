const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const projectUuid = '93c267f9-fe22-46ba-8ada-aa222b56264d'; // New Group University
  try {
    await prisma.$executeRawUnsafe('BEGIN');

    const latestEmission = await prisma.$queryRawUnsafe(`
      SELECT he.uuid::text AS emission_uuid, he.created_at, he.description,
             COUNT(pj.uuid)::int AS rows_count
      FROM handover_emissions he
      JOIN payments_jobs pj ON pj.emission_uuid = he.uuid
      WHERE pj.project_uuid = $1::uuid
      GROUP BY he.uuid, he.created_at, he.description
      ORDER BY he.created_at DESC
      LIMIT 1
    `, projectUuid);

    if (!latestEmission.length) {
      throw new Error('No emissions found for New Group University');
    }

    const emissionUuid = latestEmission[0].emission_uuid;

    const certTargets = await prisma.$queryRawUnsafe(`
      SELECT a.uuid::text AS attachment_uuid,
             a.document_no,
             a.document_date,
             (a.metadata->>'parsedIssueDate') AS parsed_issue_date
      FROM attachments a
      JOIN attachment_links al ON al.attachment_uuid = a.uuid AND al.owner_table = 'jobs'
      JOIN job_projects jp ON jp.job_uuid = al.owner_uuid
      WHERE jp.project_uuid = $1::uuid
        AND a.is_active = true
        AND a.document_type_uuid = '77e8c811-3b1c-409d-a1e4-7cc40e1b0132'::uuid
        AND a.document_no IN ('1900-26', '1901-26')
      ORDER BY a.created_at DESC
    `, projectUuid);

    if (!certTargets.length) {
      throw new Error('Target attachments (1900-26/1901-26) were not found');
    }

    for (const row of certTargets) {
      if (!row.parsed_issue_date) {
        throw new Error(`Attachment ${row.attachment_uuid} has no parsedIssueDate in metadata`);
      }
      await prisma.$executeRawUnsafe(
        `UPDATE attachments
         SET document_date = $1::date,
             updated_at = CURRENT_TIMESTAMP,
             updated_by = 'manual_fix_issue_date_2026_10_26'
         WHERE uuid = $2::uuid`,
        row.parsed_issue_date,
        row.attachment_uuid,
      );
    }

    // Temporarily disable update trigger to unlock emitted rows for this manual rollback.
    await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" DISABLE TRIGGER prevent_emitted_payments_jobs_update');

    const updated = await prisma.$executeRawUnsafe(
      `UPDATE payments_jobs
       SET emission_uuid = NULL,
           emission_date = NULL,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = 'manual_cancel_emission_2026_10_26'
       WHERE project_uuid = $1::uuid
         AND emission_uuid = $2::uuid`,
      projectUuid,
      emissionUuid,
    );

    await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" ENABLE TRIGGER prevent_emitted_payments_jobs_update');

    await prisma.$executeRawUnsafe(
      `DELETE FROM handover_emissions
       WHERE uuid = $1::uuid`,
      emissionUuid,
    );

    const postCheck = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM payments_jobs WHERE project_uuid = $1::uuid AND emission_uuid = $2::uuid) AS remaining_rows_with_old_emission,
        (SELECT COUNT(*)::int FROM handover_emissions WHERE uuid = $2::uuid) AS remaining_emission_header,
        (SELECT json_agg(json_build_object('document_no', a.document_no, 'document_date', a.document_date) ORDER BY a.document_no)
         FROM attachments a
         JOIN attachment_links al ON al.attachment_uuid = a.uuid AND al.owner_table = 'jobs'
         JOIN job_projects jp ON jp.job_uuid = al.owner_uuid
         WHERE jp.project_uuid = $1::uuid
           AND a.document_no IN ('1900-26','1901-26')
           AND a.document_type_uuid = '77e8c811-3b1c-409d-a1e4-7cc40e1b0132'::uuid
        ) AS cert_dates
    `, projectUuid, emissionUuid);

    await prisma.$executeRawUnsafe('COMMIT');

    console.log(JSON.stringify({
      success: true,
      projectUuid,
      cancelledEmissionUuid: emissionUuid,
      unlockedRowsCount: Number(updated),
      updatedAttachmentCount: certTargets.length,
      postCheck: postCheck[0],
    }, null, 2));

    await prisma.$disconnect();
  } catch (e) {
    try {
      await prisma.$executeRawUnsafe('ROLLBACK');
    } catch {}
    try {
      // Best-effort re-enable trigger if left disabled by any partial failure.
      await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" ENABLE TRIGGER prevent_emitted_payments_jobs_update');
    } catch {}
    console.error(e);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
