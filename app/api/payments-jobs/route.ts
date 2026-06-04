import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/payments-jobs?payment_uuid=xxx
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const paymentUuid = searchParams.get('payment_uuid');
  const jobUuid = searchParams.get('job_uuid');

  try {
    const where: any = {};
    if (paymentUuid) where.payment_uuid = paymentUuid;
    if (jobUuid) where.job_uuid = jobUuid;

    const distributions = await prisma.payments_jobs.findMany({
      where,
      include: {
        job: {
          select: {
            job_uuid: true,
            job_name: true,
            selling_price: true,
            factory_no: true,
          },
        },
        project: {
          select: {
            project_uuid: true,
            project_name: true,
          },
        },
      },
      orderBy: [
        { is_auto_distributed: 'desc' },
        { created_at: 'asc' },
      ],
    });

    const result = distributions.map(d => ({
      id: Number(d.id),
      uuid: d.uuid,
      payment_uuid: d.payment_uuid,
      job_uuid: d.job_uuid,
      job_name: d.job.job_name,
      job_selling_price: d.job.selling_price ? Number(d.job.selling_price) : null,
      factory_no: d.job.factory_no,
      project_uuid: d.project_uuid,
      project_name: d.project.project_name,
      amount: Number(d.amount),
      amount_account_curr: d.amount_account_curr ? Number(d.amount_account_curr) : null,
      allocation_type: d.allocation_type,
      allocation_percent: d.allocation_percent ? Number(d.allocation_percent) : null,
      is_auto_distributed: d.is_auto_distributed,
      weight_snapshot: d.weight_snapshot ? Number(d.weight_snapshot) : null,
      created_at: d.created_at.toISOString(),
      updated_at: d.updated_at.toISOString(),
      created_by: d.created_by,
      updated_by: d.updated_by,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[payments-jobs] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job distributions' },
      { status: 500 }
    );
  }
}

// POST /api/payments-jobs
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email || 'system';

  try {
    const body = await req.json();
    const {
      payment_uuid,
      distributions, // Array of { job_uuid, project_uuid, amount, amount_account_curr?, allocation_type?, allocation_percent?, is_auto_distributed?, weight_snapshot? }
      replace_all = false, // If true, delete existing and insert new
    } = body;

    if (!payment_uuid) {
      return NextResponse.json({ error: 'payment_uuid is required' }, { status: 400 });
    }

    if (!Array.isArray(distributions) || distributions.length === 0) {
      return NextResponse.json({ error: 'distributions array is required' }, { status: 400 });
    }

    // Validate all distributions have required fields
    for (const dist of distributions) {
      if (!dist.job_uuid || !dist.project_uuid || dist.amount === undefined) {
        return NextResponse.json(
          { error: 'Each distribution must have job_uuid, project_uuid, and amount' },
          { status: 400 }
        );
      }
    }

    let result;

    if (replace_all) {
      // Delete existing distributions and insert new ones
      result = await prisma.$transaction(async (tx) => {
        await tx.payments_jobs.deleteMany({
          where: { payment_uuid },
        });

        const created = await tx.payments_jobs.createMany({
          data: distributions.map((d: any) => ({
            payment_uuid,
            job_uuid: d.job_uuid,
            project_uuid: d.project_uuid,
            amount: d.amount,
            amount_account_curr: d.amount_account_curr || null,
            allocation_type: d.allocation_type || 'nominal',
            allocation_percent: d.allocation_percent || null,
            is_auto_distributed: d.is_auto_distributed || false,
            weight_snapshot: d.weight_snapshot || null,
            created_by: userEmail,
            updated_by: userEmail,
          })),
        });

        return { action: 'replaced', count: created.count };
      });
    } else {
      // Upsert individual distributions
      result = await prisma.$transaction(
        distributions.map((d: any) =>
          prisma.payments_jobs.upsert({
            where: {
              payment_uuid_job_uuid_project_uuid: {
                payment_uuid,
                job_uuid: d.job_uuid,
                project_uuid: d.project_uuid,
              },
            },
            update: {
              amount: d.amount,
              amount_account_curr: d.amount_account_curr || null,
              allocation_type: d.allocation_type || 'nominal',
              allocation_percent: d.allocation_percent || null,
              is_auto_distributed: d.is_auto_distributed || false,
              weight_snapshot: d.weight_snapshot || null,
              updated_by: userEmail,
            },
            create: {
              payment_uuid,
              job_uuid: d.job_uuid,
              project_uuid: d.project_uuid,
              amount: d.amount,
              amount_account_curr: d.amount_account_curr || null,
              allocation_type: d.allocation_type || 'nominal',
              allocation_percent: d.allocation_percent || null,
              is_auto_distributed: d.is_auto_distributed || false,
              weight_snapshot: d.weight_snapshot || null,
              created_by: userEmail,
              updated_by: userEmail,
            },
          })
        )
      );

      result = { action: 'upserted', count: result.length };
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[payments-jobs] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save job distributions' },
      { status: 500 }
    );
  }
}

// DELETE /api/payments-jobs?uuid=xxx or ?payment_uuid=xxx
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const uuid = searchParams.get('uuid');
  const paymentUuid = searchParams.get('payment_uuid');

  try {
    if (uuid) {
      // Delete single distribution by uuid
      await prisma.payments_jobs.delete({
        where: { uuid },
      });
      return NextResponse.json({ success: true, deleted: 1 });
    } else if (paymentUuid) {
      // Delete all distributions for a payment
      const result = await prisma.payments_jobs.deleteMany({
        where: { payment_uuid: paymentUuid },
      });
      return NextResponse.json({ success: true, deleted: result.count });
    } else {
      return NextResponse.json({ error: 'uuid or payment_uuid is required' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[payments-jobs] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete job distribution' },
      { status: 500 }
    );
  }
}
