import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyAccountCurrencyRate, resolveAccountCurrencyRate } from '@/lib/payments-jobs-rate';

export const dynamic = 'force-dynamic';

// POST /api/payments-jobs/auto-distribute
// Distributes a payment across all jobs in a project based on selling price weights
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email || 'system';

  try {
    const body = await req.json();
    const {
      payment_uuid,
      project_uuid,
      payment_amount,
      payment_currency_code,
      account_currency_rate = 1, // Rate to convert to GEL (account currency)
      batch_partition_uuid, // Optional: link to specific batch partition
      raw_record_uuid, // Optional: link to specific raw bank transaction (fallback)
    } = body;

    if (!payment_uuid || !project_uuid || !payment_amount) {
      return NextResponse.json(
        { error: 'payment_uuid, project_uuid, and payment_amount are required' },
        { status: 400 }
      );
    }

    // Fetch all active jobs for this project with selling prices
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
        job_name: true,
        selling_price: true,
      },
    });

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'No active jobs with selling prices found for this project' },
        { status: 400 }
      );
    }

    // Calculate total selling price
    const totalSellingPrice = jobs.reduce(
      (sum, job) => sum + Number(job.selling_price || 0),
      0
    );

    if (totalSellingPrice === 0) {
      return NextResponse.json(
        { error: 'Total selling price is zero' },
        { status: 400 }
      );
    }

    const { rate: resolvedRate } = await resolveAccountCurrencyRate(
      payment_uuid,
      project_uuid,
      account_currency_rate,
    );

    // Calculate weighted distributions
    let distributions = jobs.map((job) => {
      const sellingPrice = Number(job.selling_price || 0);
      const weight = sellingPrice / totalSellingPrice;
      const amount = Math.round(payment_amount * weight * 100) / 100;
      const amountAccountCurr = applyAccountCurrencyRate(amount, null, resolvedRate);

      return {
        job_uuid: job.job_uuid,
        project_uuid,
        amount,
        amount_account_curr: amountAccountCurr,
        allocation_type: 'auto_weighted',
        allocation_percent: Math.round(weight * 10000) / 100, // Percentage with 2 decimals
        is_auto_distributed: true,
        weight_snapshot: weight,
      };
    });

    // Correct for rounding errors
    const totalDistributed = distributions.reduce((sum, d) => sum + d.amount, 0);
    const nominalRemnant = payment_amount - totalDistributed;

    const totalDistributedAccountCurr = distributions.reduce((sum, d) => sum + d.amount_account_curr, 0);
    const totalPaymentAccountCurr = applyAccountCurrencyRate(payment_amount, null, resolvedRate);
    const accountCurrRemnant = totalPaymentAccountCurr - totalDistributedAccountCurr;

    if (distributions.length > 0 && (nominalRemnant !== 0 || accountCurrRemnant !== 0)) {
      const correctionIndex = Math.floor(Math.random() * distributions.length); // Correct a random job
      distributions[correctionIndex].amount += nominalRemnant;
      distributions[correctionIndex].amount_account_curr += accountCurrRemnant;

      // Round again after correction
      distributions[correctionIndex].amount = Math.round(distributions[correctionIndex].amount * 100) / 100;
      distributions[correctionIndex].amount_account_curr = Math.round(distributions[correctionIndex].amount_account_curr * 100) / 100;
    }

    // Replace all existing distributions with new auto-weighted ones
    await prisma.$transaction(async (tx) => {
      // Build delete WHERE clause to handle old NULL records
      let deleteWhere: any;
      
      if (batch_partition_uuid) {
        // Distributing a batched transaction: delete this batch partition + old NULL records
        deleteWhere = {
          payment_uuid,
          OR: [
            { batch_partition_uuid },
            { batch_partition_uuid: null, raw_record_uuid: null }, // Clean up old legacy data
          ],
        };
      } else if (raw_record_uuid) {
        // Distributing a raw transaction: delete this raw record + old NULL records
        deleteWhere = {
          payment_uuid,
          OR: [
            { raw_record_uuid },
            { batch_partition_uuid: null, raw_record_uuid: null }, // Clean up old legacy data
          ],
        };
      } else {
        // Distributing a regular payment: delete all distributions for this payment
        deleteWhere = { payment_uuid };
      }

      await tx.payments_jobs.deleteMany({
        where: deleteWhere,
      });

      await tx.payments_jobs.createMany({
        data: distributions.map((d) => ({
          payment_uuid,
          batch_partition_uuid: batch_partition_uuid || null,
          raw_record_uuid: raw_record_uuid || null,
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

    return NextResponse.json({
      success: true,
      distributed_to: jobs.length,
      total_selling_price: totalSellingPrice,
      distributions: distributions.map((d, i) => ({
        job_uuid: d.job_uuid,
        job_name: jobs[i].job_name,
        selling_price: Number(jobs[i].selling_price),
        weight: d.weight_snapshot,
        percent: d.allocation_percent,
        amount: d.amount,
        amount_account_curr: d.amount_account_curr,
      })),
    });
  } catch (error: any) {
    console.error('[payments-jobs/auto-distribute] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-distribute payment' },
      { status: 500 }
    );
  }
}
