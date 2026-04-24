import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';
import { getInsiderOptions, resolveInsiderSelection, sqlUuidInList } from '@/lib/insider-selection';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

// GET all jobs with project info from job_projects junction table
export async function GET(req: NextRequest) {
  try {
    const selection = await resolveInsiderSelection(req);
    const insider = selection.primaryInsider;
    const insiderUuidListSql = sqlUuidInList(selection.selectedUuids);
    const { searchParams } = new URL(req.url);
    const projectUuid = searchParams.get('projectUuid');

    // If projectUuid provided, return jobs linked to that project via job_projects
    if (projectUuid) {
      console.log('[GET /api/jobs] Fetching jobs for project:', projectUuid);
      const jobs = await withRetry(() => prisma.$queryRawUnsafe(`
        SELECT 
          j.job_uuid,
          j.job_name,
          j.floors,
          j.weight,
          j.is_ff,
          j.factory_no,
          j.brand_uuid,
          b.name as brand_name,
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
        INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
        LEFT JOIN brands b ON j.brand_uuid = b.uuid
        WHERE jp.project_uuid = $1::uuid
          AND j.insider_uuid IN (${insiderUuidListSql})
          AND j.is_active = true
        ORDER BY j.job_name ASC
      `, projectUuid));

      const serialized = (jobs as any[]).map((job: any) => ({
        jobUuid: job.job_uuid,
        jobName: job.job_name,
        floors: job.floors,
        weight: job.weight,
        isFf: job.is_ff,
        factoryNo: job.factory_no,
        brandUuid: job.brand_uuid,
        brandName: job.brand_name,
        jobDisplay: job.job_display,
        insiderUuid: job.insider_uuid || insider?.insiderUuid || null,
        insiderName: insider?.insiderName || null,
      }));

      return NextResponse.json(serialized);
    }

    // Full listing: one row per job-project binding
    const jobs = await withRetry(() => prisma.$queryRawUnsafe(`
      SELECT 
        j.id,
        j.job_uuid,
        j.job_name,
        j.floors,
        j.weight,
        j.is_ff,
        j.factory_no,
        j.brand_uuid,
        j.is_active,
        j.created_at,
        j.updated_at,
        b.name as brand_name,
        jp.project_uuid as bound_project_uuid,
        p.project_index as bound_project_index,
        p.project_name as bound_project_name,
        -- Computed job_index using this row's project
        CONCAT(
          COALESCE(p.project_name, '-'),
          ' | ',
          j.job_name,
          ' | ',
          COALESCE(b.name, '-'),
          ' | ',
          COALESCE(j.floors::text, '-'),
          ' Floors',
          ' | ',
          COALESCE(j.weight::text, '-'),
          ' kg',
          ' | ',
          CASE WHEN j.is_ff THEN 'FF' ELSE 'NOT FF' END
        ) as job_index,
        -- Total number of project bindings for this job
        (SELECT count(*) FROM job_projects jp2 WHERE jp2.job_uuid = j.job_uuid) as binding_count
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      LEFT JOIN projects p ON jp.project_uuid = p.project_uuid
      LEFT JOIN brands b ON j.brand_uuid = b.uuid
      WHERE j.insider_uuid IN (${insiderUuidListSql})
        AND j.is_active = true
      ORDER BY j.created_at DESC, p.project_index ASC
    `));

    const serialized = (jobs as any[]).map((job: any, idx: number) => ({
      id: Number(job.id),
      jobUuid: job.job_uuid,
      jobName: job.job_name,
      floors: job.floors,
      weight: job.weight,
      isFf: job.is_ff,
      factoryNo: job.factory_no,
      brandUuid: job.brand_uuid,
      brandName: job.brand_name,
      jobIndex: job.job_index,
      projectUuid: job.bound_project_uuid,
      projectIndex: job.bound_project_index || '-',
      projectName: job.bound_project_name || '-',
      bindingCount: Number(job.binding_count),
      is_active: job.is_active,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      insider_uuid: job.insider_uuid ?? insider?.insiderUuid ?? null,
      insider_name: insider?.insiderName ?? null,
      _rowKey: `${job.job_uuid}_${job.bound_project_uuid || idx}`,
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

// POST - Create a single job row + link to projects via job_projects
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const selection = await resolveInsiderSelection(req);
    const body = await req.json();
    const { projectUuid, projectUuids, jobName, floors, weight, isFf, brandUuid, factoryNo, factory_no, insider_uuid, insiderUuid } = body;

    const requestedInsiderUuid = String(insiderUuid ?? insider_uuid ?? '').trim() || null;
    const normalizedFactoryNo = String(factoryNo ?? factory_no ?? '').trim() || null;
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

    if (targetProjectUuids.length === 0 || !jobName || isFf === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if job with same name already exists for this insider+brand+project
    // Job names (L0001, L0002...) are per-project, so we must also check
    // that an existing job is already bound to one of the target projects
    const existing = await prisma.$queryRawUnsafe(`
      SELECT j.id, j.job_uuid
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      WHERE lower(j.job_name) = lower($1)
        AND j.insider_uuid = $2::uuid
        AND COALESCE(j.brand_uuid::text, '') = COALESCE($3::text, '')
        AND j.is_active = true
        AND jp.project_uuid = ANY($4::uuid[])
      LIMIT 1
    `, jobName, effectiveInsiderUuid, brandUuid || '', targetProjectUuids) as any[];

    let jobId: number;
    let jobUuidValue: string;

    if (existing.length > 0) {
      // Job already exists for this project - just add any extra project bindings
      jobId = Number(existing[0].id);
      jobUuidValue = existing[0].job_uuid;
    } else {
      // Create single job row (no project_uuid on jobs table)
      const result = await prisma.$queryRaw`
        INSERT INTO jobs (job_name, floors, weight, is_ff, factory_no, brand_uuid, insider_uuid)
        VALUES (${jobName}, ${floors ?? null}, ${weight ?? null}, ${isFf}, ${normalizedFactoryNo}, ${brandUuid}::uuid, ${effectiveInsiderUuid}::uuid)
        RETURNING id, job_uuid
      ` as any[];

      const row = result[0];
      jobId = Number(row.id);
      jobUuidValue = row.job_uuid;
    }

    // Insert project links into job_projects
    let linkedCount = 0;
    for (const projUuid of targetProjectUuids) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO job_projects (job_uuid, project_uuid) VALUES ($1::uuid, $2::uuid) ON CONFLICT (job_uuid, project_uuid) DO NOTHING`,
        jobUuidValue, projUuid
      );
      linkedCount++;
    }

    return NextResponse.json({
      created: [{ id: jobId, job_uuid: jobUuidValue }],
      linkedProjects: linkedCount,
      createdCount: existing.length > 0 ? 0 : 1,
    });
  } catch (error: any) {
    console.error('POST /api/jobs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create job' },
      { status: 500 }
    );
  }
}

// PUT - Update job parameters + sync job_projects bindings
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const selection = await resolveInsiderSelection(req);
    const body = await req.json();
    const { id, projectUuid, projectUuids, jobName, floors, weight, isFf, brandUuid, factoryNo, factory_no, insider_uuid, insiderUuid } = body;

    const requestedInsiderUuid = String(insiderUuid ?? insider_uuid ?? '').trim() || null;
    const normalizedFactoryNo = String(factoryNo ?? factory_no ?? '').trim() || null;
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

    // Get the current job's UUID
    const currentJob = await prisma.$queryRaw`
      SELECT job_uuid FROM jobs WHERE id = ${id} LIMIT 1
    ` as any[];
    if (currentJob.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const jobUuidValue = currentJob[0].job_uuid;

    // Update job parameters (no project_uuid on jobs table)
    await prisma.$queryRaw`
      UPDATE jobs
      SET 
        job_name = ${jobName},
        floors = ${floors ?? null},
        weight = ${weight ?? null},
        is_ff = ${isFf},
        factory_no = ${normalizedFactoryNo},
        brand_uuid = ${brandUuid}::uuid,
        insider_uuid = ${effectiveInsiderUuid}::uuid,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    // Sync job_projects: only remove bindings not in the new set, add new ones
    // This avoids deleting bindings that have active payments
    const currentBindings = await prisma.$queryRawUnsafe(
      `SELECT project_uuid::text FROM job_projects WHERE job_uuid = $1::uuid`,
      jobUuidValue
    ) as any[];
    const currentSet = new Set(currentBindings.map((b: any) => b.project_uuid));
    const targetSet = new Set(targetProjectUuids);

    // Remove bindings no longer in the target set
    for (const cur of currentSet) {
      if (!targetSet.has(cur)) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM job_projects WHERE job_uuid = $1::uuid AND project_uuid = $2::uuid`,
          jobUuidValue, cur
        );
      }
    }
    // Add new bindings
    for (const projUuid of targetProjectUuids) {
      if (!currentSet.has(projUuid)) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO job_projects (job_uuid, project_uuid) VALUES ($1::uuid, $2::uuid) ON CONFLICT (job_uuid, project_uuid) DO NOTHING`,
          jobUuidValue, projUuid
        );
      }
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

// DELETE - Soft delete job + clean up job_projects
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get job_uuid before deactivating
    const job = await prisma.$queryRaw`
      SELECT job_uuid FROM jobs WHERE id = ${id} LIMIT 1
    ` as any[];

    if (job.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if any active payments reference this job
    const linkedPayments = await prisma.$queryRawUnsafe(
      `SELECT count(*) as cnt FROM payments WHERE job_uuid = $1::uuid AND is_active = true`,
      job[0].job_uuid
    ) as any[];
    if (Number(linkedPayments[0].cnt) > 0) {
      return NextResponse.json(
        { error: `Cannot delete this job — it has ${Number(linkedPayments[0].cnt)} active payment(s) linked to it. Remove or reassign the payments first.` },
        { status: 409 }
      );
    }

    await prisma.$queryRaw`
      UPDATE jobs
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    // Clean up job_projects entries
    if (job.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM job_projects WHERE job_uuid = $1::uuid`,
        job[0].job_uuid
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/jobs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete job' },
      { status: 500 }
    );
  }
}

// PATCH - Bulk add projects to multiple jobs
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const body = await req.json();
    const { jobUuids, projectUuids } = body;

    if (!Array.isArray(jobUuids) || jobUuids.length === 0) {
      return NextResponse.json({ error: 'jobUuids array is required' }, { status: 400 });
    }
    if (!Array.isArray(projectUuids) || projectUuids.length === 0) {
      return NextResponse.json({ error: 'projectUuids array is required' }, { status: 400 });
    }

    let inserted = 0;
    for (const jobUuid of jobUuids) {
      for (const projUuid of projectUuids) {
        const result = await prisma.$executeRawUnsafe(
          `INSERT INTO job_projects (job_uuid, project_uuid) VALUES ($1::uuid, $2::uuid) ON CONFLICT (job_uuid, project_uuid) DO NOTHING`,
          jobUuid, projUuid
        );
        inserted += result;
      }
    }

    return NextResponse.json({ success: true, inserted, total: jobUuids.length * projectUuids.length });
  } catch (error: any) {
    console.error('PATCH /api/jobs error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to bulk bind projects' },
      { status: 500 }
    );
  }
}
