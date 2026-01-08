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
    const { name, description, isActive } = body;

    const scheme = await prisma.parsingScheme.update({
      where: { id: BigInt(params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json({
      id: Number(scheme.id),
      name: scheme.name,
      description: scheme.description,
      isActive: scheme.isActive,
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt
    });
  } catch (error: any) {
    console.error('Error updating parsing scheme:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update scheme' },
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

    await prisma.parsingScheme.delete({
      where: { id: BigInt(params.id) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting parsing scheme:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete scheme' },
      { status: 500 }
    );
  }
}
