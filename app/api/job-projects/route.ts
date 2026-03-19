import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectUuid = searchParams.get('projectUuid');

    if (!projectUuid) {
      return NextResponse.json({ error: 'projectUuid is required' }, { status: 400 });
    }

    const linked = await prisma.$queryRawUnsafe<any[]>(
      `SELECT jp.job_uuid FROM job_projects jp WHERE jp.project_uuid = $1`,
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

    // Remove all existing links for this project
    await prisma.$executeRawUnsafe(
      `DELETE FROM job_projects WHERE project_uuid = $1`,
      projectUuid
    );

    // Insert new links
    if (jobUuids.length > 0) {
      const values = jobUuids
        .map((_: string, i: number) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::uuid)`)
        .join(', ');
      const params = jobUuids.flatMap((ju: string) => [ju, projectUuid]);
      await prisma.$executeRawUnsafe(
        `INSERT INTO job_projects (job_uuid, project_uuid) VALUES ${values} ON CONFLICT (job_uuid, project_uuid) DO NOTHING`,
        ...params
      );
    }

    return NextResponse.json({ ok: true, count: jobUuids.length });
  } catch (error) {
    console.error('Error saving job-projects:', error);
    return NextResponse.json({ error: 'Failed to save job-projects' }, { status: 500 });
  }
}
