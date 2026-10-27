import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyAccountCurrencyRate, resolveAccountCurrencyRate } from '@/lib/payments-jobs-rate';
import { getSourceTables } from '@/lib/source-tables';

export const dynamic = 'force-dynamic';

const round2 = (value: number) => Math.round(value * 100) / 100;

async function resolveExpectedTransactionTotals(
  batchPartitionUuid?: string | null,
  rawRecordUuid?: string | null,
): Promise<{ nominal: number; accountCurr: number; source: 'batch' | 'raw' | 'fallback' }> {
  if (batchPartitionUuid) {
    const batchPartition = await prisma.bank_transaction_batches.findUnique({
      where: { uuid: batchPartitionUuid },
    });

    if (!batchPartition) {
      throw new Error(`Batch partition ${batchPartitionUuid} not found`);
    }

    return {
      nominal: Number(batchPartition.nominal_amount || batchPartition.partition_amount || 0),
      accountCurr: Number(batchPartition.partition_amount || 0),
      source: 'batch',
    };
  }

  if (rawRecordUuid) {
    const sourceTables = await getSourceTables();
    if (sourceTables.length > 0) {
      const unions = sourceTables.map((name) =>
        Prisma.sql`SELECT nominal_amount::numeric as nominal_amount, account_currency_amount::numeric as account_currency_amount FROM ${Prisma.raw(`"${name}"`)} WHERE uuid::text = ${rawRecordUuid}::text`,
      );

      const sql = Prisma.sql`
        SELECT nominal_amount, account_currency_amount
        FROM (${Prisma.join(unions, ' UNION ALL ')}) tx
        LIMIT 1
      `;

      const rows = await prisma.$queryRaw<{ nominal_amount: unknown; account_currency_amount: unknown }[]>(sql);
      const row = Array.isArray(rows) ? rows[0] : null;

      if (row) {
        return {
          nominal: Number(row.nominal_amount || 0),
          accountCurr: Number(row.account_currency_amount || 0),
          source: 'raw',
        };
      }
    }
  }

  return { nominal: 0, accountCurr: 0, source: 'fallback' };
}

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

    // Reconcile to the exact source transaction totals (batch partition / raw tx) to prevent drift.
    let expectedNominal = round2(Number(payment_amount || 0));
    let expectedAccountCurr = round2(Number(applyAccountCurrencyRate(expectedNominal, null, resolvedRate) || 0));

    const expected = await resolveExpectedTransactionTotals(batch_partition_uuid, raw_record_uuid);
    if (expected.source === 'batch' || expected.source === 'raw') {
      expectedNominal = round2(expected.nominal);
      expectedAccountCurr = round2(expected.accountCurr);
    }

    const totalDistributedNominal = distributions.reduce((sum, d) => sum + d.amount, 0);
    const nominalRemnant = round2(expectedNominal - totalDistributedNominal);

    const totalDistributedAccountCurr = distributions.reduce((sum, d) => sum + d.amount_account_curr, 0);
    const accountCurrRemnant = round2(expectedAccountCurr - totalDistributedAccountCurr);

    // Apply corrections to the last row so the persisted sums exactly match transaction totals.
    if (distributions.length > 0 && (Math.abs(nominalRemnant) > 0.001 || Math.abs(accountCurrRemnant) > 0.001)) {
      const lastIdx = distributions.length - 1;
      distributions[lastIdx].amount = round2(distributions[lastIdx].amount + nominalRemnant);
      distributions[lastIdx].amount_account_curr = round2(distributions[lastIdx].amount_account_curr + accountCurrRemnant);

      console.log('[payments-jobs/auto-distribute] Applied rounding correction', {
        payment_uuid,
        batch_partition_uuid: batch_partition_uuid || null,
        raw_record_uuid: raw_record_uuid || null,
        expected_source: expected.source,
        nominal_remnant: nominalRemnant,
        account_curr_remnant: accountCurrRemnant,
        applied_to_row_index: lastIdx,
      });
    }

    const finalNominal = round2(distributions.reduce((sum, d) => sum + d.amount, 0));
    const finalAccountCurr = round2(distributions.reduce((sum, d) => sum + d.amount_account_curr, 0));

    if (Math.abs(finalNominal - expectedNominal) > 0.01 || Math.abs(finalAccountCurr - expectedAccountCurr) > 0.01) {
      return NextResponse.json(
        {
          error: 'Auto-distribution reconciliation failed',
          details: {
            expected_nominal: expectedNominal,
            final_nominal: finalNominal,
            expected_account_curr: expectedAccountCurr,
            final_account_curr: finalAccountCurr,
          },
        },
        { status: 400 },
      );
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
