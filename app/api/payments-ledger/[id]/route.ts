import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating ledger entry:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
