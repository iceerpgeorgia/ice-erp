import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const financial_code_uuid = searchParams.get('financial_code_uuid');
    const template_uuid = searchParams.get('template_uuid');
    const is_active = searchParams.get('is_active');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (financial_code_uuid) where.financial_code_uuid = financial_code_uuid;
    if (template_uuid) where.template_uuid = template_uuid;
    if (is_active !== null) where.is_active = is_active === 'true';

    const [calculations, total] = await Promise.all([
      prisma.calculations_financial_codes.findMany({
        where,
        include: {
          financial_code: {
            select: {
              uuid: true,
              code: true,
              name: true,
              is_active: true,
            },
          },
          template: {
            select: {
              uuid: true,
              operation_type: true,
              file_name: true,
              is_active: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.calculations_financial_codes.count({ where }),
    ]);

    return NextResponse.json({
      data: calculations,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching calculations:', error);
    return NextResponse.json({ error: 'Failed to fetch calculations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { financial_code_uuid, template_uuid, template_name, is_active } = body;

    // Validation
    if (!financial_code_uuid || !template_uuid || !template_name) {
      return NextResponse.json(
        { error: 'Missing required fields: financial_code_uuid, template_uuid, template_name' },
        { status: 400 }
      );
    }

    // Check if financial code exists
    const financialCode = await prisma.financial_codes.findUnique({
      where: { uuid: financial_code_uuid },
    });
    if (!financialCode) {
      return NextResponse.json({ error: 'Financial code not found' }, { status: 404 });
    }

    // Check if template exists
    const template = await prisma.templates.findUnique({
      where: { uuid: template_uuid },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check for duplicates
    const existing = await prisma.calculations_financial_codes.findUnique({
      where: {
        financial_code_uuid_template_uuid: {
          financial_code_uuid,
          template_uuid,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Calculation template already exists for this financial code' },
        { status: 409 }
      );
    }

    const calculation = await prisma.calculations_financial_codes.create({
      data: {
        financial_code_uuid,
        template_uuid,
        template_name,
        is_active: is_active ?? true,
      },
      include: {
        financial_code: true,
        template: true,
      },
    });

    return NextResponse.json(calculation, { status: 201 });
  } catch (error) {
    console.error('Error creating calculation:', error);
    return NextResponse.json({ error: 'Failed to create calculation' }, { status: 500 });
  }
}
