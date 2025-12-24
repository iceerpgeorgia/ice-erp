import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    let query = `
      SELECT 
        pl.id,
        pl.payment_id,
        pl.effective_date,
        pl.accrual,
        pl."order",
        pl.record_uuid,
        pl.user_email,
        pl.created_at,
        pl.updated_at,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid
      FROM payments_ledger pl
      LEFT JOIN payments p ON pl.payment_id = p.payment_id
    `;

    const params: any[] = [];
    
    if (paymentId) {
      query += ' WHERE pl.payment_id = $1';
      params.push(paymentId);
    }

    query += ' ORDER BY pl.effective_date DESC, pl.created_at DESC';

    const ledgerEntries = await prisma.$queryRawUnsafe(query, ...params);

    const formattedEntries = (ledgerEntries as any[]).map(entry => ({
      id: Number(entry.id),
      paymentId: entry.payment_id,
      effectiveDate: entry.effective_date,
      accrual: entry.accrual,
      order: entry.order,
      recordUuid: entry.record_uuid,
      userEmail: entry.user_email,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
      projectUuid: entry.project_uuid,
      counteragentUuid: entry.counteragent_uuid,
      financialCodeUuid: entry.financial_code_uuid,
      jobUuid: entry.job_uuid,
      incomeTax: entry.income_tax,
      currencyUuid: entry.currency_uuid,
    }));

    return NextResponse.json(formattedEntries);
  } catch (error: any) {
    console.error('Error fetching payment ledger entries:', error);
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
    const { paymentId, effectiveDate, accrual, order } = body;

    // Validation
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });
    }

    // Ensure at least one of accrual or order is provided and not zero
    if ((!accrual || accrual === 0) && (!order || order === 0)) {
      return NextResponse.json(
        { error: 'Either accrual or order must be provided and cannot be zero' },
        { status: 400 }
      );
    }

    // Use current timestamp if effectiveDate is not provided
    const finalEffectiveDate = effectiveDate || new Date().toISOString();

    const query = `
      INSERT INTO payments_ledger (
        payment_id,
        effective_date,
        accrual,
        "order",
        user_email
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await prisma.$queryRawUnsafe(
      query,
      paymentId,
      finalEffectiveDate,
      accrual || null,
      order || null,
      session.user.email
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error creating payment ledger entry:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create ledger entry' },
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

    await prisma.$executeRawUnsafe(`DELETE FROM payments_ledger WHERE id = $1`, BigInt(id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting payment ledger entry:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete ledger entry' },
      { status: 500 }
    );
  }
}
