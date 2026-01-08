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

    const schemes = await prisma.parsingScheme.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            parsingRules: true,
            bankAccounts: true
          }
        }
      }
    });

    const formattedSchemes = schemes.map(scheme => ({
      id: Number(scheme.id),
      name: scheme.name,
      description: scheme.description,
      isActive: scheme.isActive,
      rulesCount: scheme._count.parsingRules,
      accountsCount: scheme._count.bankAccounts,
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt
    }));

    return NextResponse.json(formattedSchemes);
  } catch (error: any) {
    console.error('Error fetching parsing schemes:', error);
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
    const { name, description, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const scheme = await prisma.parsingScheme.create({
      data: {
        name,
        description,
        isActive: isActive ?? true
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
    console.error('Error creating parsing scheme:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create scheme' },
      { status: 500 }
    );
  }
}
