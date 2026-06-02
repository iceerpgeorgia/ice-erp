import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

/** GET /api/nav/config — returns user's folders + item overrides */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [folders, items] = await Promise.all([
    prisma.userNavFolder.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.userNavItem.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return NextResponse.json({ folders, items });
}
