import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInsiderOptions, resolveInsiderSelection, sqlUuidInList } from '@/lib/insider-selection';

// GET all jobs with project and brand info
export async function GET(req: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(req);
    const insider = selection.primaryInsider;
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const projectUuid = searchParams.get('projectUuid');

    // Simple approach: if projectUuid provided, use raw query with brand info
    if (projectUuid) {
      console.log('[GET /api/jobs] Fetching jobs for project:', projectUuid);
      const jobs = await prisma.$queryRawUnsafe(`
        SELECT 
          j.job_uuid,
          j.job_name,
          j.floors,
          j.weight,
          j.is_ff,
          j.brand_uuid,
          b.name as brand_name,
          -- Formatted job display: job_name | brand_name | floors | weight | FF
          CONCAT(
            j.job_name,
            ' | ',
            COALESCE(b.name, 'No Brand'),
            ' | ',
            j.floors,
            ' | ',
            j.weight,
            CASE WHEN j.is_ff THEN ' | FF' ELSE '' END
          ) as job_display
        FROM jobs j
        LEFT JOIN brands b ON j.brand_uuid = b.uuid
        WHERE j.project_uuid = $1::uuid
          AND j.insider_uuid IN (${insiderUuidListSql})
          AND j.is_active = true
        ORDER BY j.job_name ASC
      `, projectUuid);

      const serialized = (jobs as any[]).map((job: any) => ({
        jobUuid: job.job_uuid,
        jobName: job.job_name,
        floors: job.floors,
        weight: job.weight,
        isFf: job.is_ff,
        brandUuid: job.brand_uuid,
        brandName: job.brand_name,
        jobDisplay: job.job_display,
        insiderUuid: job.insider_uuid || insider?.insiderUuid || null,
        insiderName: insider?.insiderName || null,
      }));

      return NextResponse.json(serialized);
    }

    // Otherwise, use the full query with all fields
    const jobs = await prisma.$queryRawUnsafe(`
      SELECT 
        j.id,
        j.job_uuid,
        j.project_uuid,
        j.job_name,
        j.floors,
        j.weight,
        j.is_ff,
        j.brand_uuid,
        j.is_active,
        j.created_at,
        j.updated_at,
        p.project_index,
        p.project_name,
        b.name as brand_name,
        -- Computed job_index
        CONCAT(
          p.project_name,
          ' | ',
          j.job_name,
          ' | ',
          b.name,
          ' | ',
          j.floors,
          ' Floors',
          ' | ',
          j.weight,
          ' kg',
          ' | ',
          CASE WHEN j.is_ff THEN 'FF' ELSE 'NOT FF' END
        ) as job_index
      FROM jobs j
      LEFT JOIN projects p ON j.project_uuid = p.project_uuid
      LEFT JOIN brands b ON j.brand_uuid = b.uuid
      WHERE j.insider_uuid IN (${insiderUuidListSql})
      ORDER BY j.created_at DESC
    `);

    const serialized = (jobs as any[]).map((job: any) => ({
      id: Number(job.id),
      jobUuid: job.job_uuid,
      project_uuid: job.project_uuid,
      jobName: job.job_name,
      floors: job.floors,
      weight: job.weight,
      isFf: job.is_ff,
      brandUuid: job.brand_uuid,
      projectIndex: job.project_index,
      projectName: job.project_name,
      brandName: job.brand_name,
      jobIndex: job.job_index,
      is_active: job.is_active,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      insider_uuid: job.insider_uuid ?? insider?.insiderUuid ?? null,
      insider_name: insider?.insiderName ?? null,
    }));

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error('GET /api/jobs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST - Create new job
export async function POST(req: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(req);
    const body = await req.json();
    const { projectUuid, projectUuids, jobName, floors, weight, isFf, brandUuid, insider_uuid, insiderUuid } = body;

    const requestedInsiderUuid = String(insiderUuid ?? insider_uuid ?? '').trim() || null;
    const insiderOptions = await getInsiderOptions();
    const insiderOptionSet = new Set(insiderOptions.map((option) => option.insiderUuid.toLowerCase()));
    if (requestedInsiderUuid && !insiderOptionSet.has(requestedInsiderUuid.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid insider selection' }, { status: 400 });
    }
    const effectiveInsiderUuid = requestedInsiderUuid || selection.primaryInsider?.insiderUuid || null;
    if (!effectiveInsiderUuid) {
      return NextResponse.json({ error: 'No insider configured' }, { status: 400 });
    }

    const targetProjectUuids: string[] = Array.isArray(projectUuids)
      ? projectUuids.filter((item) => typeof item === 'string' && item.trim().length > 0)
      : (projectUuid ? [projectUuid] : []);

    // Validation
    if (targetProjectUuids.length === 0 || !jobName || isFf === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const created: Array<{ id: number | null; job_uuid: string | null }> = [];
    const skipped: string[] = [];

    for (const projectUuidItem of targetProjectUuids) {
      const existing = await prisma.$queryRaw`
        SELECT id, job_uuid
        FROM jobs
        WHERE project_uuid = ${projectUuidItem}::uuid
          AND lower(job_name) = lower(${jobName})
          AND is_active = true
        LIMIT 1
      ` as any[];

      if (existing.length > 0) {
        skipped.push(projectUuidItem);
        continue;
      }

      const result = await prisma.$queryRaw`
        INSERT INTO jobs (project_uuid, job_name, floors, weight, is_ff, brand_uuid, insider_uuid)
        VALUES (${projectUuidItem}::uuid, ${jobName}, ${floors ?? null}, ${weight ?? null}, ${isFf}, ${brandUuid}::uuid, ${effectiveInsiderUuid}::uuid)
        RETURNING id, job_uuid
      ` as any[];

      const row = result[0];
      created.push({
        id: row?.id !== undefined && row?.id !== null ? Number(row.id) : null,
        job_uuid: row?.job_uuid ?? null,
      });
    }

    return NextResponse.json({
      created,
      skippedProjectUuids: skipped,
      createdCount: created.length,
      skippedCount: skipped.length,
    });
  } catch (error: any) {
    console.error('POST /api/jobs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create job' },
      { status: 500 }
    );
  }
}

// PUT - Update job
export async function PUT(req: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(req);
    const body = await req.json();
    const { id, projectUuid, projectUuids, jobName, floors, weight, isFf, brandUuid, insider_uuid, insiderUuid } = body;

    const requestedInsiderUuid = String(insiderUuid ?? insider_uuid ?? '').trim() || null;
    const insiderOptions = await getInsiderOptions();
    const insiderOptionSet = new Set(insiderOptions.map((option) => option.insiderUuid.toLowerCase()));
    if (requestedInsiderUuid && !insiderOptionSet.has(requestedInsiderUuid.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid insider selection' }, { status: 400 });
    }
    const effectiveInsiderUuid = requestedInsiderUuid || selection.primaryInsider?.insiderUuid || null;
    if (!effectiveInsiderUuid) {
      return NextResponse.json({ error: 'No insider configured' }, { status: 400 });
    }

    const targetProjectUuids: string[] = Array.isArray(projectUuids)
      ? projectUuids.filter((item) => typeof item === 'string' && item.trim().length > 0)
      : (projectUuid ? [projectUuid] : []);

    if (!id) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    if (targetProjectUuids.length === 0) {
      return NextResponse.json(
        { error: 'At least one project is required' },
        { status: 400 }
      );
    }

    const primaryProjectUuid = targetProjectUuids[0];

    await prisma.$queryRaw`
      UPDATE jobs
      SET 
        project_uuid = ${primaryProjectUuid}::uuid,
        job_name = ${jobName},
        floors = ${floors ?? null},
        weight = ${weight ?? null},
        is_ff = ${isFf},
        brand_uuid = ${brandUuid}::uuid,
        insider_uuid = ${effectiveInsiderUuid}::uuid,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    const additionalProjects = targetProjectUuids.slice(1);
    for (const projectUuidItem of additionalProjects) {
      const existing = await prisma.$queryRaw`
        SELECT id
        FROM jobs
        WHERE project_uuid = ${projectUuidItem}::uuid
          AND lower(job_name) = lower(${jobName})
          AND is_active = true
        LIMIT 1
      ` as any[];

      if (existing.length > 0) continue;

      await prisma.$queryRaw`
        INSERT INTO jobs (project_uuid, job_name, floors, weight, is_ff, brand_uuid, insider_uuid)
        VALUES (${projectUuidItem}::uuid, ${jobName}, ${floors ?? null}, ${weight ?? null}, ${isFf}, ${brandUuid}::uuid, ${effectiveInsiderUuid}::uuid)
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT /api/jobs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update job' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete job
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    await prisma.$queryRaw`
      UPDATE jobs
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/jobs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete job' },
      { status: 500 }
    );
  }
}

