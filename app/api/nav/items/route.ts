import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateItemSchema = z.object({
  routeKey: z.string(),
  icon: z.string().nullable().optional(),
  folderId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

/** PATCH /api/nav/items — upsert a single item override */
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = UpdateItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { routeKey, icon, folderId, sortOrder } = parsed.data;

  const item = await prisma.userNavItem.upsert({
    where: { userId_routeKey: { userId, routeKey } },
    create: {
      id: crypto.randomUUID(),
      userId,
      routeKey,
      icon: icon ?? null,
      folderId: folderId ?? null,
      sortOrder: sortOrder ?? 0,
    },
    update: {
      ...(icon !== undefined && { icon }),
      ...(folderId !== undefined && { folderId }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json(item);
}
