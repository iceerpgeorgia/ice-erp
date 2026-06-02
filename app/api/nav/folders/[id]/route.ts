import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

type Params = { params: { id: string } };

/** PATCH /api/nav/folders/[id] — update folder name/icon/order */
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const folder = await prisma.userNavFolder.findFirst({ where: { id: params.id, userId } });
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateFolderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.userNavFolder.update({
    where: { id: params.id },
    data: { ...parsed.data, updatedAt: new Date() },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/nav/folders/[id] — delete folder (items become unassigned) */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const folder = await prisma.userNavFolder.findFirst({ where: { id: params.id, userId } });
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Items will be set to folderId=null automatically via ON DELETE SET NULL
  await prisma.userNavFolder.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
