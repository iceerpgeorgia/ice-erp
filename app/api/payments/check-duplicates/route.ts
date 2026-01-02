import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectUuid, counteragentUuid, financialCodeUuid, jobUuid, currencyUuid, excludeId } = body;

    // Build where clause based on provided fields
    const where: any = {
      isActive: true,
    };

    if (projectUuid) where.projectUuid = projectUuid;
    if (counteragentUuid) where.counteragentUuid = counteragentUuid;
    if (financialCodeUuid) where.financialCodeUuid = financialCodeUuid;
    if (currencyUuid) where.currencyUuid = currencyUuid;
    
    // Handle jobUuid - can be null or a specific value
    if (jobUuid === null || jobUuid === '') {
      where.jobUuid = null;
    } else if (jobUuid) {
      where.jobUuid = jobUuid;
    }

    // Exclude current record if editing
    if (excludeId) {
      where.id = { not: Number(excludeId) };
    }

    const matches = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        paymentId: true,
        projectUuid: true,
        counteragentUuid: true,
        financialCodeUuid: true,
        jobUuid: true,
        currencyUuid: true,
      },
    });

    return NextResponse.json({ 
      count: matches.length,
      matches: matches.map(m => ({
        id: m.id,
        paymentId: m.paymentId,
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
