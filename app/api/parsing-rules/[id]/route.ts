import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { columnName, conditionOperator, conditionValue, paymentId, priority, isActive } = body;

    const rule = await prisma.bankAccountParsingRule.update({
      where: { id: BigInt(params.id) },
      data: {
        ...(columnName !== undefined && { columnName }),
        ...(conditionOperator !== undefined && { conditionOperator }),
        ...(conditionValue !== undefined && { conditionValue }),
        ...(paymentId !== undefined && { paymentId }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive })
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
    console.error('Error updating parsing rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.bankAccountParsingRule.delete({
      where: { id: BigInt(params.id) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting parsing rule:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete rule' },
      { status: 500 }
    );
  }
}
