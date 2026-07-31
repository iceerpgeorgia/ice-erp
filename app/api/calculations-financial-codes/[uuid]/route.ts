import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { uuid: string } }) {
  try {
    const { uuid } = params;

    const calculation = await prisma.calculations_financial_codes.findUnique({
      where: { uuid },
      include: {
        financial_code: true,
        template: true,
      },
    });

    if (!calculation) {
      return NextResponse.json({ error: 'Calculation not found' }, { status: 404 });
    }

    return NextResponse.json(calculation);
  } catch (error) {
    console.error('Error fetching calculation:', error);
    return NextResponse.json({ error: 'Failed to fetch calculation' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { uuid: string } }) {
  try {
    const { uuid } = params;
    const body = await req.json();
    const { template_name, is_active } = body;

    const calculation = await prisma.calculations_financial_codes.update({
      where: { uuid },
      data: {
        ...(template_name && { template_name }),
        ...(is_active !== undefined && { is_active }),
      },
      include: {
        financial_code: true,
        template: true,
      },
    });

    return NextResponse.json(calculation);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Calculation not found' }, { status: 404 });
    }
    console.error('Error updating calculation:', error);
    return NextResponse.json({ error: 'Failed to update calculation' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { uuid: string } }) {
  try {
    const { uuid } = params;

    await prisma.calculations_financial_codes.delete({
      where: { uuid },
    });

    return NextResponse.json({ message: 'Calculation deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Calculation not found' }, { status: 404 });
    }
    console.error('Error deleting calculation:', error);
    return NextResponse.json({ error: 'Failed to delete calculation' }, { status: 500 });
  }
}
