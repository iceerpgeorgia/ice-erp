const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const projectUuid = '93c267f9-fe22-46ba-8ada-aa222b56264d'; // New Group University
  try {
    await prisma.$executeRawUnsafe('BEGIN');
    await prisma.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    await prisma.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");

    const latest = await prisma.$queryRawUnsafe(`
      SELECT he.uuid::text AS emission_uuid, he.created_at
      FROM handover_emissions he
      JOIN payments_jobs pj ON pj.emission_uuid = he.uuid
      WHERE pj.project_uuid = $1::uuid
      GROUP BY he.uuid, he.created_at
      ORDER BY he.created_at DESC
      LIMIT 1
    `, projectUuid);

    if (!latest.length) throw new Error('No emission found for project');
    const emissionUuid = latest[0].emission_uuid;

    const attachmentUpdateResult = await prisma.$executeRawUnsafe(`
      UPDATE attachments a
      SET document_date = (a.metadata->>'parsedIssueDate')::date,
          updated_at = CURRENT_TIMESTAMP
      FROM attachment_links al
      JOIN job_projects jp ON jp.job_uuid = al.owner_uuid
      WHERE al.attachment_uuid = a.uuid
        AND al.owner_table = 'jobs'
        AND jp.project_uuid = $1::uuid
        AND a.is_active = true
        AND a.document_type_uuid = '77e8c811-3b1c-409d-a1e4-7cc40e1b0132'::uuid
        AND a.document_no IN ('1900-26','1901-26')
        AND (a.metadata->>'parsedIssueDate') IS NOT NULL
        AND a.document_date IS DISTINCT FROM (a.metadata->>'parsedIssueDate')::date
    `, projectUuid);

    await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" DISABLE TRIGGER USER');

    const emissionRollbackResult = await prisma.$executeRawUnsafe(`
      UPDATE payments_jobs
      SET emission_uuid = NULL,
          emission_date = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE project_uuid = $1::uuid
        AND emission_uuid = $2::uuid
    `, projectUuid, emissionUuid);

    await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" ENABLE TRIGGER USER');

    const deleteEmissionResult = await prisma.$executeRawUnsafe(`
      DELETE FROM handover_emissions
      WHERE uuid = $1::uuid
    `, emissionUuid);

    await prisma.$executeRawUnsafe('COMMIT');

    console.log(JSON.stringify({
      success: true,
      projectUuid,
      cancelledEmissionUuid: emissionUuid,
      attachmentsUpdated: Number(attachmentUpdateResult),
      rowsUnlocked: Number(emissionRollbackResult),
      emissionHeadersDeleted: Number(deleteEmissionResult),
    }, null, 2));

    await prisma.$disconnect();
  } catch (e) {
    try { await prisma.$executeRawUnsafe('ROLLBACK'); } catch {}
    try { await prisma.$executeRawUnsafe('ALTER TABLE "payments_jobs" ENABLE TRIGGER USER'); } catch {}
    console.error('APPLY_FIX_ERROR:', e?.message || e);
    try { await prisma.$disconnect(); } catch {}
    process.exit(1);
  }
})();
