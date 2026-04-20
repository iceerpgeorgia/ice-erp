import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

// GET all payment bundles (with their member payments)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');

    if (uuid) {
      // Get single bundle with its member payments
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT pb.uuid as bundle_uuid, pb.label, pb.is_active,
                pb.created_at, pb.updated_at,
                p.payment_id, p.counteragent_uuid, p.project_uuid, p.financial_code_uuid,
                p.job_uuid, p.income_tax, p.currency_uuid, p.record_uuid,
                ca.counteragent as counteragent_name, ca.name as counteragent_short_name
         FROM payment_bundles pb
         LEFT JOIN payments p ON p.payment_bundle_uuid = pb.uuid
         LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
         WHERE pb.uuid = $1::uuid`,
        uuid
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
      }
      const bundle = {
        uuid: rows[0].bundle_uuid,
        label: rows[0].label,
        isActive: rows[0].is_active,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
        members: rows
          .filter((r: any) => r.payment_id)
          .map((r: any) => ({
            paymentId: r.payment_id,
            counteragentUuid: r.counteragent_uuid,
            counteragent: r.counteragent_name || r.counteragent_short_name,
          })),
      };
      return NextResponse.json(bundle);
    }

    // Get all active bundles
    const bundles = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pb.uuid, pb.label, pb.is_active, pb.created_at, pb.updated_at,
              COUNT(p.id) as member_count
       FROM payment_bundles pb
       LEFT JOIN payments p ON p.payment_bundle_uuid = pb.uuid AND p.is_active = true
       WHERE pb.is_active = true
       GROUP BY pb.uuid, pb.label, pb.is_active, pb.created_at, pb.updated_at
       ORDER BY pb.created_at DESC`
    );

    return NextResponse.json(
      bundles.map((b: any) => ({
        uuid: b.uuid,
        label: b.label,
        isActive: b.is_active,
        memberCount: Number(b.member_count),
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      }))
    );
  } catch (error: any) {
    console.error('Error fetching payment bundles:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - create a new bundle and assign existing payments to it
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { label, paymentIds } = body;

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 payment IDs are required to create a bundle' },
        { status: 400 }
      );
    }

    // Validate all payments exist and none already belong to a bundle
    const payments = await prisma.$queryRawUnsafe<any[]>(
      `SELECT payment_id, payment_bundle_uuid, counteragent_uuid, project_uuid,
              financial_code_uuid, job_uuid, income_tax, currency_uuid
       FROM payments
       WHERE payment_id = ANY($1::text[]) AND is_active = true`,
      paymentIds
    );

    if (payments.length !== paymentIds.length) {
      const found = new Set(payments.map((p: any) => p.payment_id));
      const missing = paymentIds.filter((id: string) => !found.has(id));
      return NextResponse.json(
        { error: `Payments not found: ${missing.join(', ')}` },
        { status: 404 }
      );
    }

    const alreadyBundled = payments.filter((p: any) => p.payment_bundle_uuid);
    if (alreadyBundled.length > 0) {
      return NextResponse.json(
        { error: `Payments already in a bundle: ${alreadyBundled.map((p: any) => p.payment_id).join(', ')}` },
        { status: 409 }
      );
    }

    // Validate bundle members share the same project, FC, job, income_tax, currency
    const first = payments[0];
    for (const p of payments) {
      if (p.project_uuid !== first.project_uuid ||
          p.financial_code_uuid !== first.financial_code_uuid ||
          p.job_uuid !== first.job_uuid ||
          p.income_tax !== first.income_tax ||
          p.currency_uuid !== first.currency_uuid) {
        return NextResponse.json(
          { error: 'All bundle members must share the same project, financial code, job, income tax, and currency. Only counteragent should differ.' },
          { status: 400 }
        );
      }
    }

    // Create bundle and assign payments in a transaction
    const bundleResult = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO payment_bundles (label, updated_at) VALUES ($1, NOW()) RETURNING uuid`,
      label || null
    );
    const bundleUuid = bundleResult[0].uuid;

    await prisma.$queryRawUnsafe(
      `UPDATE payments SET payment_bundle_uuid = $1::uuid WHERE payment_id = ANY($2::text[])`,
      bundleUuid,
      paymentIds
    );

    return NextResponse.json({ success: true, bundleUuid });
  } catch (error: any) {
    console.error('Error creating payment bundle:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bundle' },
      { status: 500 }
    );
  }
}

// PATCH - update bundle (label, add/remove members)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { uuid, label, addPaymentIds, removePaymentIds, isActive } = body;

    if (!uuid) {
      return NextResponse.json({ error: 'Bundle uuid is required' }, { status: 400 });
    }

    // Verify bundle exists
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT uuid FROM payment_bundles WHERE uuid = $1::uuid`, uuid
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    // Update label if provided
    if (label !== undefined) {
      await prisma.$queryRawUnsafe(
        `UPDATE payment_bundles SET label = $1, updated_at = NOW() WHERE uuid = $2::uuid`,
        label || null, uuid
      );
    }

    // Update is_active if provided
    if (isActive !== undefined) {
      await prisma.$queryRawUnsafe(
        `UPDATE payment_bundles SET is_active = $1::boolean, updated_at = NOW() WHERE uuid = $2::uuid`,
        isActive, uuid
      );
      // If deactivating, unlink all payments
      if (!isActive) {
        await prisma.$queryRawUnsafe(
          `UPDATE payments SET payment_bundle_uuid = NULL WHERE payment_bundle_uuid = $1::uuid`,
          uuid
        );
      }
    }

    // Add payment IDs to bundle
    if (addPaymentIds && addPaymentIds.length > 0) {
      await prisma.$queryRawUnsafe(
        `UPDATE payments SET payment_bundle_uuid = $1::uuid WHERE payment_id = ANY($2::text[]) AND payment_bundle_uuid IS NULL`,
        uuid, addPaymentIds
      );
    }

    // Remove payment IDs from bundle
    if (removePaymentIds && removePaymentIds.length > 0) {
      await prisma.$queryRawUnsafe(
        `UPDATE payments SET payment_bundle_uuid = NULL WHERE payment_id = ANY($1::text[]) AND payment_bundle_uuid = $2::uuid`,
        removePaymentIds, uuid
      );
    }

    // Check remaining member count - bundle should have >= 2 members
    const remaining = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as cnt FROM payments WHERE payment_bundle_uuid = $1::uuid AND is_active = true`,
      uuid
    );
    const memberCount = Number(remaining[0].cnt);

    if (memberCount === 1) {
      // Auto-disband single-member bundle
      await prisma.$queryRawUnsafe(
        `UPDATE payments SET payment_bundle_uuid = NULL WHERE payment_bundle_uuid = $1::uuid`, uuid
      );
      await prisma.$queryRawUnsafe(
        `UPDATE payment_bundles SET is_active = false, updated_at = NOW() WHERE uuid = $1::uuid`, uuid
      );
      return NextResponse.json({ success: true, disbanded: true, reason: 'Bundle must have at least 2 members' });
    }

    return NextResponse.json({ success: true, memberCount });
  } catch (error: any) {
    console.error('Error updating payment bundle:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update bundle' },
      { status: 500 }
    );
  }
}
