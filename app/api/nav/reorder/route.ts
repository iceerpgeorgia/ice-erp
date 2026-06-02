import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ReorderSchema = z.object({
  folders: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).optional(),
  items: z.array(z.object({
    routeKey: z.string(),
    folderId: z.string().nullable(),
    sortOrder: z.number().int(),
  })).optional(),
});

/** POST /api/nav/reorder — bulk-update folder and item sort orders */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = ReorderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { folders, items } = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (folders?.length) {
      for (const { id, sortOrder } of folders) {
        await tx.userNavFolder.updateMany({
          where: { id, userId },
          data: { sortOrder, updatedAt: new Date() },
        });
      }
    }
    if (items?.length) {
      for (const { routeKey, folderId, sortOrder } of items) {
        await tx.userNavItem.upsert({
          where: { userId_routeKey: { userId, routeKey } },
          create: { id: crypto.randomUUID(), userId, routeKey, folderId, sortOrder, icon: null },
          update: { folderId, sortOrder },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
