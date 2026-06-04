import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/payments-jobs?payment_uuid=xxx&project_uuid=xxx
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const paymentUuid = searchParams.get('payment_uuid');
  const jobUuid = searchParams.get('job_uuid');
  const projectUuid = searchParams.get('project_uuid');

  try {
    const where: any = {};
    if (paymentUuid) where.payment_uuid = paymentUuid;
    if (jobUuid) where.job_uuid = jobUuid;
    if (projectUuid) where.project_uuid = projectUuid;

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
        payment: {
          select: {
            payment_id: true,
            counteragent_uuid: true,
            financial_code_uuid: true,
            currency_uuid: true,
          },
        },
      },
      orderBy: [
        { is_auto_distributed: 'desc' },
        { created_at: 'asc' },
      ],
    });

    // Get unique UUIDs for batch queries
    const counteragentUuids = [...new Set(distributions.map(d => d.payment.counteragent_uuid))];
    const fcUuids = [...new Set(distributions.map(d => d.payment.financial_code_uuid))];
    const currencyUuids = [...new Set(distributions.map(d => d.payment.currency_uuid))];
    const paymentUuids = [...new Set(distributions.map(d => d.payment_uuid))];

    // Batch fetch related data
    const [counteragents, financialCodes, currencies, ledgerTotals] = await Promise.all([
      prisma.counteragents.findMany({
        where: { counteragent_uuid: { in: counteragentUuids } },
        select: { counteragent_uuid: true, name: true },
      }),
      prisma.financial_codes.findMany({
        where: { uuid: { in: fcUuids } },
        select: { uuid: true, code: true },
      }),
      prisma.currencies.findMany({
        where: { uuid: { in: currencyUuids } },
        select: { uuid: true, code: true },
      }),
      prisma.payments_ledger.groupBy({
        by: ['payment_id'],
        where: {
          payment_id: { in: distributions.map(d => d.payment.payment_id) },
          is_deleted: false,
        },
        _sum: {
          accrual: true,
          order: true,
        },
      }),
    ]);

    // Create lookup maps
    const counteragentMap = new Map(counteragents.map(c => [c.counteragent_uuid, c.name]));
    const fcMap = new Map(financialCodes.map(fc => [fc.uuid, fc.code]));
    const currencyMap = new Map(currencies.map(cur => [cur.uuid, cur.code]));
    const ledgerMap = new Map(
      ledgerTotals.map(l => [
        l.payment_id,
        {
          accrual: Number(l._sum.accrual || 0),
          order: Number(l._sum.order || 0),
        },
      ])
    );

    const result = distributions.map(d => ({
      id: Number(d.id),
      uuid: d.uuid,
      payment_uuid: d.payment_uuid,
      payment_id: d.payment.payment_id,
      payment_amount: ledgerMap.get(d.payment.payment_id)?.accrual ?? 0,
      payment_currency_code: currencyMap.get(d.payment.currency_uuid) || 'GEL',
      counteragent_name: counteragentMap.get(d.payment.counteragent_uuid) || null,
      financial_code_code: fcMap.get(d.payment.financial_code_uuid) || null,
      job_uuid: d.job_uuid,
      job_name: d.job.job_name,
      job_selling_price: d.job.selling_price ? Number(d.job.selling_price) : null,
      factory_no: d.job.factory_no,
      project_uuid: d.project_uuid,
      project_name: d.project.project_name,
      amount: Number(d.amount),
      amount_account_curr: d.amount_account_curr != null ? Number(d.amount_account_curr) : null,
      allocation_type: d.allocation_type,
      allocation_percent: d.allocation_percent != null ? Number(d.allocation_percent) : null,
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
            amount_account_curr: d.amount_account_curr ?? null,
            allocation_type: d.allocation_type || 'nominal',
            allocation_percent: d.allocation_percent ?? null,
            is_auto_distributed: d.is_auto_distributed || false,
            weight_snapshot: d.weight_snapshot ?? null,
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
