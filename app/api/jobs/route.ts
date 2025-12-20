import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all jobs with project and brand info
export async function GET(req: NextRequest) {
  try {
    const jobs = await prisma.$queryRaw`
      SELECT 
        j.id,
        j.job_uuid,
        j.project_uuid,
        j.job_name,
        j.floors,
        j.weight,
        j.is_ff,
        j.brand_id,
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
      LEFT JOIN brands b ON j.brand_id = b.id
      ORDER BY j.created_at DESC
    `;

    const serialized = (jobs as any[]).map((job: any) => ({
      ...job,
      id: Number(job.id),
      brand_id: Number(job.brand_id),
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
    const body = await req.json();
    const { projectUuid, jobName, floors, weight, isFf, brandId } = body;

    // Validation
    if (!projectUuid || !jobName || floors === undefined || weight === undefined || isFf === undefined || !brandId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await prisma.$queryRaw`
      INSERT INTO jobs (project_uuid, job_name, floors, weight, is_ff, brand_id)
      VALUES (${projectUuid}::uuid, ${jobName}, ${floors}, ${weight}, ${isFf}, ${brandId})
      RETURNING id, job_uuid
    ` as any[];

    return NextResponse.json(result[0]);
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
    const body = await req.json();
    const { id, projectUuid, jobName, floors, weight, isFf, brandId } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    await prisma.$queryRaw`
      UPDATE jobs
      SET 
        project_uuid = ${projectUuid}::uuid,
        job_name = ${jobName},
        floors = ${floors},
        weight = ${weight},
        is_ff = ${isFf},
        brand_id = ${brandId},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

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
