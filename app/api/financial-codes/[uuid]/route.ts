import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const uuid = params?.uuid;

    if (!uuid) {
      return NextResponse.json({ error: 'UUID is required' }, { status: 400 });
    }

    const financialCode = await prisma.financial_codes.findUnique({
      where: { uuid },
    });

    if (!financialCode) {
      return NextResponse.json({ error: 'Financial code not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...financialCode,
      id: String(financialCode.id),
    });
  } catch (error: any) {
    console.error('Error fetching financial code by UUID:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial code', details: error?.message },
      { status: 500 }
    );
  }
}
