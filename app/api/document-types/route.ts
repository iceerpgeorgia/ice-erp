import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/document-types
 * Fetch all active document types
 */
export async function GET(request: NextRequest) {
  try {
    const documentTypes = await prisma.document_types.findMany({
      where: {
        is_active: true,
      },
      select: {
        uuid: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ documentTypes });
  } catch (error: any) {
    console.error('Error fetching document types:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch document types' },
      { status: 500 }
    );
  }
}
