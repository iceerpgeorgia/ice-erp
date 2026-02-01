import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

const safeStringify = (value: unknown) =>
  JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val));

const logAudit = async (params: {
  recordId: bigint;
  action: string;
  userEmail?: string | null;
  userId?: string | null;
  changes?: unknown;
}) => {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AuditLog" ("table", record_id, action, user_email, user_id, changes)
     VALUES ($1, $2::bigint, $3, $4, $5, $6::jsonb)`,
    'payments_ledger',
    params.recordId,
    params.action,
    params.userEmail || null,
    params.userId || null,
    safeStringify(params.changes ?? {})
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const records = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM payments_ledger WHERE id = $1 LIMIT 1`,
      id
    );

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const record = records[0];
    const serializable: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      serializable[key] = typeof value === 'bigint' ? value.toString() : value;
    }

    return NextResponse.json(serializable);
  } catch (error: any) {
    console.error('Error fetching ledger entry:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { paymentId, effectiveDate, accrual, order, comment } = body;

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    if (!effectiveDate) {
      return NextResponse.json({ error: 'Effective date is required' }, { status: 400 });
    }

    // Verify the new payment exists
    const paymentData = await prisma.$queryRawUnsafe<Array<{
      payment_id: string;
    }>>(
      `SELECT payment_id
       FROM payments 
       WHERE payment_id = $1 AND is_active = true`,
      paymentId
    );

    if (!Array.isArray(paymentData) || paymentData.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const beforeUpdate = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM payments_ledger WHERE id = $1`,
      id
    );

    const totals = await prisma.$queryRawUnsafe<Array<{ accrual_total: any; order_total: any }>>(
      `SELECT
         COALESCE(SUM(accrual), 0) AS accrual_total,
         COALESCE(SUM("order"), 0) AS order_total
       FROM payments_ledger
       WHERE payment_id = $1
         AND id <> $2
         AND (is_deleted = false OR is_deleted IS NULL)`,
      paymentId,
      id
    );

    const existingAccrual = Number(totals?.[0]?.accrual_total ?? 0);
    const existingOrder = Number(totals?.[0]?.order_total ?? 0);
    const newAccrual = Number(accrual || 0);
    const newOrder = Number(order || 0);

    if (existingOrder + newOrder > existingAccrual + newAccrual) {
      return NextResponse.json(
        { error: 'Total order cannot exceed total accrual for this payment' },
        { status: 400 }
      );
    }

    // Update the ledger entry with date, amounts, and comment
    await prisma.$queryRawUnsafe(
      `UPDATE payments_ledger 
       SET payment_id = $1, 
           effective_date = $2::date,
           accrual = $3, 
           "order" = $4,
           comment = $5,
           updated_at = NOW()
       WHERE id = $6`,
      paymentId,
      effectiveDate,
      accrual || 0,
      order || 0,
      comment || null,
      id
    );

    const afterUpdate = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM payments_ledger WHERE id = $1`,
      id
    );

    await logAudit({
      recordId: BigInt(id),
      action: 'update',
      userEmail: session.user.email,
      changes: { before: beforeUpdate?.[0] ?? null, after: afterUpdate?.[0] ?? null }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating ledger entry:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
