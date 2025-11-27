import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const states: any[] = await prisma.$queryRaw`
      SELECT * FROM project_states ORDER BY name ASC
    `;

    // Convert BigInt to number for JSON serialization
    const serializedStates = states.map(state => ({
      ...state,
      id: Number(state.id),
    }));

    return NextResponse.json(serializedStates);
  } catch (error: any) {
    console.error('GET /project-states error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch project states' },
      { status: 500 }
    );
  }
}
