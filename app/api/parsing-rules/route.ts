import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsingSchemeId = searchParams.get('parsingSchemeId');

    if (!parsingSchemeId) {
      return NextResponse.json({ error: 'parsingSchemeId is required' }, { status: 400 });
    }

    const rules = await prisma.bankAccountParsingRule.findMany({
      where: { parsingSchemeId: BigInt(parsingSchemeId) },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    const formattedRules = rules.map(rule => ({
      id: Number(rule.id),
      parsingSchemeId: Number(rule.parsingSchemeId),
      columnName: rule.columnName,
      conditionOperator: rule.conditionOperator,
      conditionValue: rule.conditionValue,
      paymentId: rule.paymentId,
      priority: rule.priority,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    }));

    return NextResponse.json(formattedRules);
  } catch (error: any) {
    console.error('Error fetching parsing rules:', error);
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
    const { parsingSchemeId, columnName, conditionOperator, conditionValue, paymentId, priority, isActive } = body;

    if (!parsingSchemeId || !columnName || !conditionOperator || !paymentId) {
      return NextResponse.json(
        { error: 'parsingSchemeId, columnName, conditionOperator, and paymentId are required' },
        { status: 400 }
      );
    }

    const rule = await prisma.bankAccountParsingRule.create({
      data: {
        parsingSchemeId: BigInt(parsingSchemeId),
        columnName,
        conditionOperator,
        conditionValue,
        paymentId,
        priority: priority ?? 0,
        isActive: isActive ?? true
      }
    });

    return NextResponse.json({
      id: Number(rule.id),
      parsingSchemeId: Number(rule.parsingSchemeId),
      columnName: rule.columnName,
      conditionOperator: rule.conditionOperator,
      conditionValue: rule.conditionValue,
      paymentId: rule.paymentId,
      priority: rule.priority,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    });
  } catch (error: any) {
    console.error('Error creating parsing rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create rule' },
      { status: 500 }
    );
  }
}
