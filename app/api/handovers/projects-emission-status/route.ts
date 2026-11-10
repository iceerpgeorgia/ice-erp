import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { getJobLiftCertInfo } from '@/lib/attachments';
import { resolveInsiderSelection, sqlUuidInList } from '@/lib/insider-selection';

export const dynamic = 'force-dynamic';

function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(req);
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);

    // Pending means: cert-dated jobs that either still have non-emitted distributions,
    // or have no distributions created yet.
    const pendingRows = await withRetry(() =>
      prisma.$queryRawUnsafe<Array<{ project_uuid: string; job_uuid: string }>>(
        `SELECT DISTINCT
           j.project_uuid::text AS project_uuid,
           j.job_uuid::text AS job_uuid
         FROM jobs j
         JOIN projects p ON p.project_uuid = j.project_uuid
         WHERE p.insider_uuid IN (${insiderUuidListSql})
           AND EXISTS (
             SELECT 1
             FROM attachment_links al
             JOIN attachments a ON a.uuid = al.attachment_uuid
             WHERE al.owner_table = 'jobs'
               AND al.owner_uuid = j.job_uuid
               AND a.is_active = true
               AND a.document_type_uuid IS NOT NULL
               AND (a.document_no IS NOT NULL OR a.document_date IS NOT NULL)
           )
           AND (
             EXISTS (
               SELECT 1
               FROM payments_jobs pj_pending
               WHERE pj_pending.project_uuid = j.project_uuid
                 AND pj_pending.job_uuid = j.job_uuid
                 AND pj_pending.emission_uuid IS NULL
             )
             OR NOT EXISTS (
               SELECT 1
               FROM payments_jobs pj_any
               WHERE pj_any.project_uuid = j.project_uuid
                 AND pj_any.job_uuid = j.job_uuid
             )
             )`,
      ),
    );
    const allJobUuids = Array.from(new Set(pendingRows.map((r) => r.job_uuid).filter(Boolean)));
    
    if (allJobUuids.length === 0) {
      return NextResponse.json({ projectStatuses: [] });
    }

    const liftInfo = await getJobLiftCertInfo(allJobUuids);

    const byProject = new Map<string, Set<string>>();
    for (const row of pendingRows) {
      const dateKey = toDateKey(liftInfo[row.job_uuid]?.date ?? null);
      if (!dateKey) continue;
      const set = byProject.get(row.project_uuid) ?? new Set<string>();
      set.add(dateKey);
      byProject.set(row.project_uuid, set);
    }

    const projectStatuses = Array.from(byProject.entries())
      .map(([projectUuid, certDateSet]) => {
        const certDatesWithoutEmission = Array.from(certDateSet).sort((a, b) => a.localeCompare(b));
        return {
          projectUuid,
          certDatesWithoutEmission,
          missingEmissionCount: certDatesWithoutEmission.length,
          hasMissingEmissions: certDatesWithoutEmission.length > 0,
        };
      })
      .filter((item) => item.hasMissingEmissions);

    return NextResponse.json({ projectStatuses });
  } catch (error) {
    console.error('[Handovers] Failed to build projects emission status:', error);
    return NextResponse.json(
      { error: 'Failed to load projects emission status' },
      { status: 500 },
    );
  }
}
