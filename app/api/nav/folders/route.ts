import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().default('Folder'),
  sortOrder: z.number().int().default(0),
});

/** POST /api/nav/folders — create a new nav folder */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const userId = authResult.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateFolderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, icon, sortOrder } = parsed.data;

  const folder = await prisma.userNavFolder.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      name,
      icon,
      sortOrder,
    },
  });

  return NextResponse.json(folder, { status: 201 });
}
