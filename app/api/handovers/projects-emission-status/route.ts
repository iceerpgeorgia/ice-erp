import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { getJobLiftCertInfo } from '@/lib/attachments';
import { resolveInsiderSelection, sqlUuidInList } from '@/lib/insider-selection';

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

    const rows = await withRetry(() =>
      prisma.$queryRawUnsafe<Array<{ project_uuid: string; job_uuid: string }>>(
        `SELECT DISTINCT
           pj.project_uuid::text AS project_uuid,
           pj.job_uuid::text AS job_uuid
         FROM payments_jobs pj
         JOIN projects p ON p.project_uuid = pj.project_uuid
         WHERE pj.emission_uuid IS NULL
           AND p.insider_uuid IN (${insiderUuidListSql})`,
      ),
    );

    const allJobUuids = Array.from(new Set(rows.map((r) => r.job_uuid).filter(Boolean)));
    if (allJobUuids.length === 0) {
      return NextResponse.json({ projectStatuses: [] });
    }

    const liftInfo = await getJobLiftCertInfo(allJobUuids);

    const byProject = new Map<string, Set<string>>();
    for (const row of rows) {
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
