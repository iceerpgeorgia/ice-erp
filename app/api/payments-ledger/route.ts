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
        pl.comment,
        pl.record_uuid,
        pl.user_email,
        pl.created_at,
        pl.updated_at,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        proj.project_index,
        proj.project_name,
        ca.name as counteragent_name,
        ca.identification_number as counteragent_id,
        ca.entity_type as counteragent_entity_type,
        fc.validation as financial_code_validation,
        fc.code as financial_code,
        j.job_name,
        curr.code as currency_code
      FROM payments_ledger pl
      LEFT JOIN payments p ON pl.payment_id = p.payment_id
      LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
      LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
      LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
      LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
      LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
    `;

    const params: any[] = [];
    
    if (paymentId) {
      query += ' WHERE pl.payment_id = $1';
      params.push(paymentId);
    }

    query += ' ORDER BY pl.effective_date DESC, pl.created_at DESC';
    
    // Limit to most recent 1000 entries to prevent slow page loads
    if (!paymentId) {
      query += ' LIMIT 1000';
    }

    const ledgerEntries = await prisma.$queryRawUnsafe(query, ...params);

    const formattedEntries = (ledgerEntries as any[]).map(entry => ({
      id: Number(entry.id),
      paymentId: entry.payment_id,
      effectiveDate: entry.effective_date,
      accrual: entry.accrual,
      order: entry.order,
      comment: entry.comment,
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
      projectIndex: entry.project_index,
      projectName: entry.project_name,
      counteragentName: entry.counteragent_name,
      counteragentId: entry.counteragent_id,
      counteragentEntityType: entry.counteragent_entity_type,
      financialCodeValidation: entry.financial_code_validation,
      financialCode: entry.financial_code,
      jobName: entry.job_name,
      currencyCode: entry.currency_code,
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
    const { paymentId, effectiveDate, accrual, order, comment } = body;

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

    // Convert date format from dd.mm.yyyy to yyyy-mm-dd if provided
    let finalEffectiveDate;
    if (effectiveDate) {
      // Check if it's in dd.mm.yyyy format
      const ddmmyyyyPattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
      const match = effectiveDate.match(ddmmyyyyPattern);
      
      if (match) {
        // Convert dd.mm.yyyy to yyyy-mm-dd
        const [, day, month, year] = match;
        finalEffectiveDate = `${year}-${month}-${day}`;
      } else {
        // Already in ISO format or other format
        finalEffectiveDate = effectiveDate;
      }
    } else {
      // Use current date in yyyy-mm-dd format
      const now = new Date();
      finalEffectiveDate = now.toISOString().split('T')[0];
    }

    const query = `
      INSERT INTO payments_ledger (
        payment_id,
        effective_date,
        accrual,
        "order",
        comment,
        user_email
      ) VALUES ($1, $2::timestamp, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await prisma.$queryRawUnsafe(
      query,
      paymentId,
      finalEffectiveDate,
      accrual || null,
      order || null,
      comment || null,
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
