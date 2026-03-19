import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectUuid = searchParams.get('projectUuid');

    if (!projectUuid) {
      return NextResponse.json({ error: 'projectUuid is required' }, { status: 400 });
    }

    // Fallback to legacy jobs.project_uuid so preselection still works
    // even when a project has not been explicitly migrated into job_projects.
    const linked = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT DISTINCT job_uuid
        FROM (
          SELECT jp.job_uuid
          FROM job_projects jp
          WHERE jp.project_uuid = $1::uuid

          UNION

          SELECT j.job_uuid
          FROM jobs j
          WHERE j.project_uuid = $1::uuid
        ) links
      `,
      projectUuid
    );

    return NextResponse.json(linked.map((r) => r.job_uuid));
  } catch (error) {
    console.error('Error fetching job-projects:', error);
    return NextResponse.json({ error: 'Failed to fetch job-projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectUuid, jobUuids } = body;

    if (!projectUuid || !Array.isArray(jobUuids)) {
      return NextResponse.json({ error: 'projectUuid and jobUuids[] are required' }, { status: 400 });
    }

    const normalizedProjectUuid = String(projectUuid).trim();
    if (!UUID_REGEX.test(normalizedProjectUuid)) {
      return NextResponse.json({ error: 'Invalid projectUuid' }, { status: 400 });
    }

    const normalizedJobUuids = Array.from(
      new Set(
        jobUuids
          .map((value: unknown) => String(value ?? '').trim())
          .filter((value: string) => UUID_REGEX.test(value))
      )
    );

    await prisma.$transaction(async (tx) => {
      // Remove all existing links for this project
      await tx.$executeRawUnsafe(
        `DELETE FROM job_projects WHERE project_uuid = $1::uuid`,
        normalizedProjectUuid
      );

      // Insert new links
      if (normalizedJobUuids.length > 0) {
        const values = normalizedJobUuids
          .map((_: string, i: number) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::uuid)`)
          .join(', ');
        const params = normalizedJobUuids.flatMap((ju: string) => [ju, normalizedProjectUuid]);
        await tx.$executeRawUnsafe(
          `INSERT INTO job_projects (job_uuid, project_uuid) VALUES ${values} ON CONFLICT (job_uuid, project_uuid) DO NOTHING`,
          ...params
        );
      }
    });

    return NextResponse.json({ ok: true, count: normalizedJobUuids.length });
  } catch (error) {
    console.error('Error saving job-projects:', error);
    return NextResponse.json({ error: 'Failed to save job-projects' }, { status: 500 });
  }
}
