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

    // Query job_projects junction table directly
    const linked = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT DISTINCT jp.job_uuid
        FROM job_projects jp
        WHERE jp.project_uuid = $1::uuid
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
  const { requireAuth, isAuthError } = await import('@/lib/auth-guard');
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
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
      // Get current bindings for this project
      const currentBindings = await tx.$queryRawUnsafe<{ job_uuid: string }[]>(
        `SELECT job_uuid FROM job_projects WHERE project_uuid = $1::uuid`,
        normalizedProjectUuid
      );
      const currentJobUuids = new Set(currentBindings.map((r) => r.job_uuid));
      const targetJobUuids = new Set(normalizedJobUuids);

      // Remove only bindings not in the target set
      const toRemove = [...currentJobUuids].filter((id) => !targetJobUuids.has(id));
      if (toRemove.length > 0) {
        const placeholders = toRemove.map((_, i) => `$${i + 2}::uuid`).join(', ');
        await tx.$executeRawUnsafe(
          `DELETE FROM job_projects WHERE project_uuid = $1::uuid AND job_uuid IN (${placeholders})`,
          normalizedProjectUuid,
          ...toRemove
        );
      }

      // Add only bindings not already present
      const toAdd = normalizedJobUuids.filter((id: string) => !currentJobUuids.has(id));
      if (toAdd.length > 0) {
        const values = toAdd
          .map((_: string, i: number) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::uuid)`)
          .join(', ');
        const params = toAdd.flatMap((ju: string) => [ju, normalizedProjectUuid]);
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
