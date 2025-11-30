import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const states = await prisma.$queryRaw`
      SELECT * FROM project_states ORDER BY name ASC
    `;

    return NextResponse.json(states);
  } catch (error: any) {
    console.error('GET /project-states error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch project states' },
      { status: 500 }
    );
  }
}
