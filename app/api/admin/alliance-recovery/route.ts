/**
 * Alliance Highline Payment Recovery Endpoint
 * 
 * POST /api/admin/alliance-recovery
 * 
 * Body: { "action": "analyze" | "recover", "confirm": boolean }
 * 
 * This endpoint allows safe recovery of cost payment IDs that were accidentally cleared
 * for the Alliance Highline project in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Admin auth check
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  
  if (!secret) {
    console.warn('⚠️  CRON_SECRET not configured - endpoint disabled');
    return false;
  }
  
  return authHeader === `Bearer ${secret}`;
}

const prisma = new PrismaClient();
const ALLIANCE_PROJECT_UUID = 'dc975886-9bf9-42c8-afbe-87695aa01262';

interface RecoveryRequest {
  action: 'analyze' | 'recover';
  confirm?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: RecoveryRequest = await req.json();
    const { action, confirm } = body;

    if (!['analyze', 'recover'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const projectUuidCast = ALLIANCE_PROJECT_UUID as unknown as any;

    // Step 1: Get current state
    const [incomeStats, costStats] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN payment_id IS NOT NULL THEN 1 END) as with_id,
          COUNT(CASE WHEN payment_id IS NULL THEN 1 END) as missing
        FROM payments
        WHERE project_uuid = ${projectUuidCast}::uuid
          AND waybill_derived = false
      `,
      prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN payment_id IS NOT NULL THEN 1 END) as with_id,
          COUNT(CASE WHEN payment_id IS NULL THEN 1 END) as missing
        FROM payments
        WHERE project_uuid = ${projectUuidCast}::uuid
          AND waybill_derived = true
      `,
    ]);

    const incomeRow = incomeStats[0];
    const costRow = costStats[0];

    // If analyze, just return current state
    if (action === 'analyze') {
      return NextResponse.json({
        status: 'analyzed',
        income: {
          total: incomeRow.total,
          with_id: incomeRow.with_id,
          missing: incomeRow.missing,
        },
        cost: {
          total: costRow.total,
          with_id: costRow.with_id,
          missing: costRow.missing,
        },
        needsRecovery: costRow.missing > 0,
        message: costRow.missing > 0 
          ? `${costRow.missing}/${costRow.total} cost payments missing payment_id`
          : 'All payments in correct state',
      });
    }

    // If recover, attempt to fix
    if (action === 'recover' && !confirm) {
      return NextResponse.json(
        { error: 'Recovery requires confirm=true' },
        { status: 400 }
      );
    }

    if (costRow.missing === 0) {
      return NextResponse.json({
        status: 'skipped',
        message: 'No cost payments need recovery',
      });
    }

    // Try to recover from waybill relationships
    const orphanedCostPayments = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id,
        p.financial_code_uuid,
        p.counteragent_uuid,
        p.accrual_source,
        ROW_NUMBER() OVER (PARTITION BY p.financial_code_uuid, p.counteragent_uuid ORDER BY p.id) as match_idx
      FROM payments p
      WHERE p.project_uuid = ${projectUuidCast}::uuid
        AND p.waybill_derived = true
        AND p.payment_id IS NULL
      ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id
    `;

    const sourceWaybillPayments = await prisma.$queryRaw<any[]>`
      SELECT 
        p.id,
        p.payment_id,
        p.financial_code_uuid,
        p.counteragent_uuid,
        ROW_NUMBER() OVER (PARTITION BY p.financial_code_uuid, p.counteragent_uuid ORDER BY p.id) as match_idx
      FROM payments p
      WHERE p.project_uuid = ${projectUuidCast}::uuid
        AND p.waybill_derived = true
        AND p.payment_id IS NOT NULL
      ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id
    `;

    if (sourceWaybillPayments.length < orphanedCostPayments.length) {
      return NextResponse.json({
        status: 'insufficient_data',
        message: `Have ${sourceWaybillPayments.length} sources but need ${orphanedCostPayments.length}`,
        recommendation: 'Restore from Supabase point-in-time backup',
      }, { status: 409 });
    }

    // Build recovery mapping
    const sourceMap = new Map<string, any[]>();
    sourceWaybillPayments.forEach(p => {
      const key = `${p.financial_code_uuid}|${p.counteragent_uuid}`;
      if (!sourceMap.has(key)) sourceMap.set(key, []);
      sourceMap.get(key)!.push(p);
    });

    const updates: Array<{ id: bigint; payment_id: string }> = [];
    orphanedCostPayments.forEach(p => {
      const key = `${p.financial_code_uuid}|${p.counteragent_uuid}`;
      const sources = sourceMap.get(key);
      if (sources && sources.length > p.match_idx - 1) {
        const source = sources[p.match_idx - 1];
        updates.push({ id: p.id, payment_id: source.payment_id });
      }
    });

    // Execute updates
    let successCount = 0;
    let errors: string[] = [];

    for (const u of updates) {
      try {
        await prisma.payments.update({
          where: { id: u.id },
          data: { payment_id: u.payment_id },
        });
        successCount++;
      } catch (err: any) {
        errors.push(`Payment ${u.id}: ${err.message}`);
      }
    }

    // Final verification
    const finalStats = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN payment_id IS NOT NULL THEN 1 END) as with_id,
        COUNT(CASE WHEN payment_id IS NULL THEN 1 END) as missing
      FROM payments
      WHERE project_uuid = ${projectUuidCast}::uuid
        AND waybill_derived = true
    `;

    const finalRow = finalStats[0];

    return NextResponse.json({
      status: finalRow.missing === 0 ? 'success' : 'partial_success',
      updated: successCount,
      total: updates.length,
      errors: errors.length > 0 ? errors : undefined,
      final_state: {
        cost_payments_total: finalRow.total,
        cost_payments_with_id: finalRow.with_id,
        cost_payments_missing: finalRow.missing,
      },
      message: finalRow.missing === 0 
        ? 'All cost payments recovered'
        : `Recovery incomplete - ${finalRow.missing} still missing`,
    });
  } catch (err: any) {
    console.error('Recovery endpoint error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export const maxDuration = 60;
