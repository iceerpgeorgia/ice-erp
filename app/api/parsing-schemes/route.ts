import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schemes = await prisma.$queryRaw`
      SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme
    `;

    return NextResponse.json(schemes);
  } catch (error) {
    console.error('Error fetching parsing schemes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch parsing schemes' },
      { status: 500 }
    );
  }
}
