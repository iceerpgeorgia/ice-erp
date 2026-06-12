import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { applyAccountCurrencyRate, resolveAccountCurrencyRate } from '@/lib/payments-jobs-rate';

export const dynamic = 'force-dynamic';

// GET /api/payments-jobs?payment_uuid=xxx&project_uuid=xxx&raw_record_uuid=xxx
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const paymentUuid = searchParams.get('payment_uuid');
  const jobUuid = searchParams.get('job_uuid');
  const projectUuid = searchParams.get('project_uuid');
  const rawRecordUuid = searchParams.get('raw_record_uuid');

  try {
    const where: any = {};
    if (paymentUuid) where.payment_uuid = paymentUuid;
    if (jobUuid) where.job_uuid = jobUuid;
    if (projectUuid) where.project_uuid = projectUuid;
    if (rawRecordUuid) where.raw_record_uuid = rawRecordUuid;

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
      raw_record_uuid: d.raw_record_uuid,
      batch_partition_uuid: d.batch_partition_uuid,
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
      batch_partition_uuid, // Optional: link to specific batch partition (takes precedence)
      raw_record_uuid, // Optional: link to specific raw bank transaction (fallback for non-batched)
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

    const { rate: resolvedRate } = await resolveAccountCurrencyRate(
      payment_uuid,
      distributions[0]?.project_uuid ?? null,
      null,
    );

    const normalizedDistributions = distributions.map((dist: any) => {
      const amount = Number(dist.amount);
      const amountAccountCurr = dist.amount_account_curr != null
        ? Number(dist.amount_account_curr)
        : null;

      return {
        ...dist,
        amount,
        amount_account_curr: applyAccountCurrencyRate(amount, amountAccountCurr, resolvedRate),
      };
    });

    // ── Validation: Check that distributions sum equals transaction amount ────────────────────
    const totalDistributedNominal = normalizedDistributions.reduce(
      (sum, d) => sum + Number(d.amount || 0),
      0
    );
    const totalDistributedAccountCurr = normalizedDistributions.reduce(
      (sum, d) => sum + Number(d.amount_account_curr || 0),
      0
    );

    // Get expected transaction amounts
    let expectedNominal = 0;
    let expectedAccountCurr = 0;

    if (batch_partition_uuid) {
      // Get from batch partition
      const batchPartition = await prisma.bank_transaction_batches.findUnique({
        where: { uuid: batch_partition_uuid },
      });
      if (!batchPartition) {
        return NextResponse.json(
          { error: `Batch partition ${batch_partition_uuid} not found` },
          { status: 404 }
        );
      }
      // Use nominal_amount if available, otherwise fall back to partition_amount
      expectedNominal = Number(batchPartition.nominal_amount || batchPartition.partition_amount || 0);
      expectedAccountCurr = Number(batchPartition.partition_amount || 0);
    } else if (raw_record_uuid) {
      // Get from raw bank transaction tables
      // Try both tables
      let rawTx: any = await prisma.$queryRaw`
        SELECT nominal_amount, account_currency_amount FROM "GE78BG0000000893486000_BOG_GEL"
        WHERE uuid::text = ${raw_record_uuid}::text
        UNION ALL
        SELECT nominal_amount, account_currency_amount FROM "GE65TB7856036050100002_TBC_GEL"
        WHERE uuid::text = ${raw_record_uuid}::text
        LIMIT 1
      `;
      if (rawTx && rawTx.length > 0) {
        expectedNominal = Number(rawTx[0].nominal_amount || 0);
        expectedAccountCurr = Number(rawTx[0].account_currency_amount || 0);
      }
    }

    // Allow tolerance for rounding (scales with number of distributions to account for floating-point precision)
    // Base tolerance 0.02 + 0.01 per additional row for floating-point accumulation
    const baseTolerance = 0.02;
    const rowTolerance = Math.max(0, (distributions.length - 1) * 0.01);
    const TOLERANCE = baseTolerance + rowTolerance;
    
    if (Math.abs(totalDistributedNominal - expectedNominal) > TOLERANCE) {
      return NextResponse.json(
        {
          error: 'Distribution validation failed: nominal amounts do not match transaction',
          details: {
            transaction_nominal: expectedNominal,
            distributed_nominal: totalDistributedNominal,
            gap: expectedNominal - totalDistributedNominal,
            tolerance: TOLERANCE,
          },
        },
        { status: 400 }
      );
    }

    if (Math.abs(totalDistributedAccountCurr - expectedAccountCurr) > TOLERANCE) {
      return NextResponse.json(
        {
          error: 'Distribution validation failed: account currency amounts do not match transaction',
          details: {
            transaction_account_curr: expectedAccountCurr,
            distributed_account_curr: totalDistributedAccountCurr,
            gap: expectedAccountCurr - totalDistributedAccountCurr,
            tolerance: TOLERANCE,
          },
        },
        { status: 400 }
      );
    }

    // ── Apply rounding correction to ensure exact match ─────────────────────────────────────────
    // Calculate remaining gaps after all distributions
    const nominalRemnant = Number((expectedNominal - totalDistributedNominal).toFixed(2));
    const accountCurrRemnant = Number((expectedAccountCurr - totalDistributedAccountCurr).toFixed(2));

    // Apply corrections to last distribution to ensure exact sum
    if (normalizedDistributions.length > 0 && (Math.abs(nominalRemnant) > 0.001 || Math.abs(accountCurrRemnant) > 0.001)) {
      const lastIdx = normalizedDistributions.length - 1;
      normalizedDistributions[lastIdx].amount = Number((normalizedDistributions[lastIdx].amount + nominalRemnant).toFixed(2));
      normalizedDistributions[lastIdx].amount_account_curr = Number(((normalizedDistributions[lastIdx].amount_account_curr || 0) + accountCurrRemnant).toFixed(2));

      console.log('[Payments-Jobs] Applied rounding correction:', {
        payment_uuid,
        batch_partition_uuid,
        raw_record_uuid,
        nominal_remnant: nominalRemnant,
        account_curr_remnant: accountCurrRemnant,
        applied_to_job_idx: lastIdx,
      });
    }

    let result;

    if (replace_all) {
      // Delete existing distributions (filtered by batch_partition_uuid or raw_record_uuid if provided) and insert new ones
      result = await prisma.$transaction(async (tx) => {
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

        const created = await tx.payments_jobs.createMany({
          data: normalizedDistributions.map((d: any) => ({
            payment_uuid,
            batch_partition_uuid: batch_partition_uuid || null,
            raw_record_uuid: raw_record_uuid || null,
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
      // For transaction-specific distributions, we need to find by all fields including raw_record_uuid
      const upsertResults = [];
      for (const d of normalizedDistributions) {
        const findWhere: any = {
          payment_uuid,
          job_uuid: d.job_uuid,
          project_uuid: d.project_uuid,
        };
        if (batch_partition_uuid) {
          findWhere.batch_partition_uuid = batch_partition_uuid;
        } else if (raw_record_uuid) {
          findWhere.raw_record_uuid = raw_record_uuid;
        }

        const existing = await prisma.payments_jobs.findFirst({
          where: findWhere,
        });

        if (existing) {
          const updated = await prisma.payments_jobs.update({
            where: { uuid: existing.uuid },
            data: {
              amount: d.amount,
              amount_account_curr: d.amount_account_curr || null,
              allocation_type: d.allocation_type || 'nominal',
              allocation_percent: d.allocation_percent || null,
              is_auto_distributed: d.is_auto_distributed || false,
              weight_snapshot: d.weight_snapshot || null,
              updated_by: userEmail,
            },
          });
          upsertResults.push(updated);
        } else {
          const created = await prisma.payments_jobs.create({
            data: {
              payment_uuid,
              batch_partition_uuid: batch_partition_uuid || null,
              raw_record_uuid: raw_record_uuid || null,
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
          });
          upsertResults.push(created);
        }
      }

      result = { action: 'upserted', count: upsertResults.length };
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

// DELETE /api/payments-jobs?uuid=xxx or ?payment_uuid=xxx&batch_partition_uuid=xxx
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const uuid = searchParams.get('uuid');
  const paymentUuid = searchParams.get('payment_uuid');
  const batchPartitionUuid = searchParams.get('batch_partition_uuid');

  try {
    if (uuid) {
      // Delete single distribution by uuid
      await prisma.payments_jobs.delete({
        where: { uuid },
      });
      return NextResponse.json({ success: true, deleted: 1 });
    } else if (paymentUuid) {
      // Delete distributions for a payment (optionally filtered by batch_partition_uuid)
      const deleteWhere: any = { payment_uuid: paymentUuid };
      if (batchPartitionUuid) {
        deleteWhere.batch_partition_uuid = batchPartitionUuid;
      }

      const result = await prisma.payments_jobs.deleteMany({
        where: deleteWhere,
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
