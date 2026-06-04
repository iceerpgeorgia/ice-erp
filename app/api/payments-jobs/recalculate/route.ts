import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/payments-jobs/recalculate
// Recalculates auto-distributed payments for a project when job selling prices change
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email || 'system';

  try {
    const body = await req.json();
    const { project_uuid, payment_uuid } = body;

    if (!project_uuid && !payment_uuid) {
      return NextResponse.json(
        { error: 'Either project_uuid or payment_uuid is required' },
        { status: 400 }
      );
    }

    // Find all auto-distributed payments that need recalculation
    const autoDistributions = await prisma.payments_jobs.findMany({
      where: {
        is_auto_distributed: true,
        ...(payment_uuid ? { payment_uuid } : { project_uuid }),
      },
      include: {
        payment: {
          include: {
            payments_ledger: {
              select: {
                accrual: true,
                order: true,
              },
            },
          },
        },
      },
    });

    if (autoDistributions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No auto-distributed payments found',
        recalculated: 0,
      });
    }

    // Group by payment_uuid
    const paymentGroups = autoDistributions.reduce((acc, dist) => {
      if (!acc[dist.payment_uuid]) {
        acc[dist.payment_uuid] = {
          payment_uuid: dist.payment_uuid,
          project_uuid: dist.project_uuid,
          distributions: [],
          payment: dist.payment,
        };
      }
      acc[dist.payment_uuid].distributions.push(dist);
      return acc;
    }, {} as Record<string, any>);

    const recalculatedPayments: string[] = [];

    // Recalculate each payment group
    for (const group of Object.values(paymentGroups)) {
      const { payment_uuid, project_uuid, payment } = group as any;

      // Calculate total payment amount from ledger
      const totalAccrual = payment.payments_ledger.reduce(
        (sum: number, l: any) => sum + Number(l.accrual || 0),
        0
      );
      const totalOrder = payment.payments_ledger.reduce(
        (sum: number, l: any) => sum + Number(l.order || 0),
        0
      );
      const paymentAmount = totalAccrual + totalOrder;

      if (paymentAmount === 0) {
        continue;
      }

      // Fetch current jobs with selling prices
      const jobs = await prisma.jobs.findMany({
        where: {
          project_uuid,
          is_active: true,
          selling_price: {
            not: null,
            gt: 0,
          },
        },
        select: {
          job_uuid: true,
          selling_price: true,
        },
      });

      if (jobs.length === 0) {
        continue;
      }

      // Calculate new weights
      const totalSellingPrice = jobs.reduce(
        (sum, job) => sum + Number(job.selling_price || 0),
        0
      );

      if (totalSellingPrice === 0) {
        continue;
      }

      const newDistributions = jobs.map((job) => {
        const sellingPrice = Number(job.selling_price || 0);
        const weight = sellingPrice / totalSellingPrice;
        const amount = Math.round(paymentAmount * weight * 100) / 100;

        return {
          job_uuid: job.job_uuid,
          project_uuid,
          amount,
          amount_account_curr: amount, // Assuming same currency for now
          allocation_type: 'auto_weighted',
          allocation_percent: Math.round(weight * 10000) / 100,
          is_auto_distributed: true,
          weight_snapshot: weight,
        };
      });

      // Update distributions
      await prisma.$transaction(async (tx) => {
        await tx.payments_jobs.deleteMany({
          where: { payment_uuid },
        });

        await tx.payments_jobs.createMany({
          data: newDistributions.map((d) => ({
            payment_uuid,
            job_uuid: d.job_uuid,
            project_uuid: d.project_uuid,
            amount: d.amount,
            amount_account_curr: d.amount_account_curr,
            allocation_type: d.allocation_type,
            allocation_percent: d.allocation_percent,
            is_auto_distributed: d.is_auto_distributed,
            weight_snapshot: d.weight_snapshot,
            created_by: userEmail,
            updated_by: userEmail,
          })),
        });
      });

      recalculatedPayments.push(payment_uuid);
    }

    return NextResponse.json({
      success: true,
      recalculated: recalculatedPayments.length,
      payment_uuids: recalculatedPayments,
    });
  } catch (error: any) {
    console.error('[payments-jobs/recalculate] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate distributions' },
      { status: 500 }
    );
  }
}
