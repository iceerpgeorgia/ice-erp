import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectUuid, counteragentUuid, financialCodeUuid, jobUuid, currencyUuid, incomeTax, excludeId } = body;

    // Build where clause based on provided fields
    const where: any = {
      is_active: true,
    };

    // Mandatory fields
    if (counteragentUuid) where.counteragentUuid = counteragentUuid;
    if (financialCodeUuid) where.financialCodeUuid = financialCodeUuid;
    if (currencyUuid) where.currencyUuid = currencyUuid;

    // Optional fields - include in query if provided
    if (projectUuid !== undefined && projectUuid !== null && projectUuid !== '') {
      where.projectUuid = projectUuid;
    } else if (projectUuid === null || projectUuid === '') {
      where.projectUuid = null;
    }
    
    // Handle jobUuid - can be null or a specific value
    if (jobUuid === null || jobUuid === '') {
      where.jobUuid = null;
    } else if (jobUuid) {
      where.jobUuid = jobUuid;
    }

    // Handle income tax - boolean field
    if (typeof incomeTax === 'boolean') {
      where.incomeTax = incomeTax;
    }

    // Exclude current record if editing
    if (excludeId) {
      where.id = { not: Number(excludeId) };
    }

    const matches = await prisma.payments.findMany({
      where,
      select: {
        id: true,
        payment_id: true,
        project_uuid: true,
        counteragent_uuid: true,
        financial_code_uuid: true,
        job_uuid: true,
        currency_uuid: true,
        income_tax: true,
      },
    });

    return NextResponse.json({ 
      count: matches.length,
      matches: matches.map(m => ({
        id: m.id,
        payment_id: m.payment_id,
      })),
    });
  } catch (error: any) {
    console.error('[POST /api/payments/check-duplicates] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check duplicates' },
      { status: 500 }
    );
  }
}


