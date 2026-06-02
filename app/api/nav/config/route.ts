import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { DEFAULT_FOLDERS, DEFAULT_ITEMS } from '@/lib/nav/default-config';
import { randomUUID } from 'crypto';

/** GET /api/nav/config — returns user's folders + item overrides, seeding defaults on first access */
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let [folders, items] = await Promise.all([
    prisma.userNavFolder.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.userNavItem.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  // First-time user: seed the default nav configuration
  if (folders.length === 0) {
    // Create folders with fresh UUIDs
    const folderIdMap: string[] = DEFAULT_FOLDERS.map(() => randomUUID());

    await prisma.userNavFolder.createMany({
      data: DEFAULT_FOLDERS.map((f, i) => ({
        id: folderIdMap[i],
        userId,
        name: f.name,
        icon: '',
        sortOrder: f.sortOrder,
      })),
    });

    await prisma.userNavItem.createMany({
      data: DEFAULT_ITEMS.map(item => ({
        id: randomUUID(),
        userId,
        routeKey: item.routeKey,
        folderId: folderIdMap[item.folderIndex],
        sortOrder: item.sortOrder,
        icon: item.icon,
      })),
    });

    // Re-fetch the seeded data
    [folders, items] = await Promise.all([
      prisma.userNavFolder.findMany({
        where: { userId },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.userNavItem.findMany({
        where: { userId },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
  }

  return NextResponse.json({ folders, items });
}
