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
    'payment_adjustments',
    params.recordId,
    params.action,
    params.userEmail || null,
    params.userId || null,
    safeStringify(params.changes ?? {})
  );
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    const adjustments = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         pa.id,
         pa.payment_id,
         pa.effective_date,
         pa.amount,
         pa.comment,
         pa.record_uuid,
         pa.user_email,
         pa.created_at,
         pa.updated_at,
         pa.is_deleted
       FROM payment_adjustments pa
       WHERE pa.payment_id = $1
         AND (pa.is_deleted = false OR pa.is_deleted IS NULL)
       ORDER BY pa.effective_date DESC, pa.created_at DESC`,
      paymentId
    );

    const formatted = adjustments.map(entry => ({
      id: Number(entry.id),
      paymentId: entry.payment_id,
      effectiveDate: entry.effective_date,
      amount: entry.amount ? parseFloat(entry.amount) : 0,
      comment: entry.comment,
      recordUuid: entry.record_uuid,
      userEmail: entry.user_email,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching payment adjustments:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentId, effectiveDate, amount, comment } = body;

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    if (amount === undefined || amount === null || amount === 0) {
      return NextResponse.json({ error: 'Amount is required and cannot be zero' }, { status: 400 });
    }

    // Verify payment exists
    const paymentRows = await prisma.$queryRawUnsafe<Array<{ payment_id: string; insider_uuid: string | null }>>(
      `SELECT payment_id, insider_uuid
       FROM payments
       WHERE payment_id = $1 AND is_active = true
       LIMIT 1`,
      paymentId
    );

    if (!Array.isArray(paymentRows) || paymentRows.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const insiderUuid = paymentRows[0]?.insider_uuid;
    if (!insiderUuid) {
      return NextResponse.json(
        { error: 'Payment insider UUID is missing; cannot create adjustment' },
        { status: 422 }
      );
    }

    // Convert dd.mm.yyyy to yyyy-mm-dd if needed
    let finalEffectiveDate: string;
    if (effectiveDate) {
      const ddmmyyyyPattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
      const match = effectiveDate.match(ddmmyyyyPattern);
      if (match) {
        const [, day, month, year] = match;
        finalEffectiveDate = `${year}-${month}-${day}`;
      } else {
        finalEffectiveDate = effectiveDate;
      }
    } else {
      finalEffectiveDate = new Date().toISOString().split('T')[0];
    }

    const result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO payment_adjustments (
         payment_id,
         effective_date,
         amount,
         comment,
         user_email,
         insider_uuid
       ) VALUES ($1, $2::timestamp, $3, $4, $5, $6::uuid)
       RETURNING *`,
      paymentId,
      finalEffectiveDate,
      amount,
      comment || null,
      session.user.email,
      insiderUuid
    );

    const formatted = result.map(entry => ({
      ...entry,
      id: Number(entry.id),
    }));

    if (formatted[0]) {
      await logAudit({
        recordId: BigInt(formatted[0].id),
        action: 'create',
        userEmail: session.user.email,
        changes: { after: formatted[0] },
      });
    }

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error creating payment adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create adjustment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, effectiveDate, amount, comment } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM payment_adjustments WHERE id = $1`,
      BigInt(id)
    );

    if (!existing?.length) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    const sets: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (effectiveDate !== undefined) {
      let finalDate = effectiveDate;
      const ddmmyyyyPattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
      const match = effectiveDate.match(ddmmyyyyPattern);
      if (match) {
        const [, day, month, year] = match;
        finalDate = `${year}-${month}-${day}`;
      }
      sets.push(`effective_date = $${paramIdx}::timestamp`);
      params.push(finalDate);
      paramIdx++;
    }

    if (amount !== undefined) {
      sets.push(`amount = $${paramIdx}`);
      params.push(amount);
      paramIdx++;
    }

    if (comment !== undefined) {
      sets.push(`comment = $${paramIdx}`);
      params.push(comment || null);
      paramIdx++;
    }

    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(BigInt(id));
    const query = `UPDATE payment_adjustments SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    const formatted = result.map(entry => ({
      ...entry,
      id: Number(entry.id),
    }));

    await logAudit({
      recordId: BigInt(id),
      action: 'update',
      userEmail: session.user.email,
      changes: { before: existing[0], after: formatted[0] },
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error updating payment adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update adjustment' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM payment_adjustments WHERE id = $1`,
      BigInt(id)
    );

    await prisma.$executeRawUnsafe(
      `DELETE FROM payment_adjustments WHERE id = $1`,
      BigInt(id)
    );

    await logAudit({
      recordId: BigInt(id),
      action: 'delete',
      userEmail: session.user.email,
      changes: { before: existing?.[0] ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting payment adjustment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete adjustment' },
      { status: 500 }
    );
  }
}
