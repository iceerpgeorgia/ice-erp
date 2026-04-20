import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { parentUuid: string } }
) {
  const { parentUuid } = params;

  if (!parentUuid) {
    return NextResponse.json({ error: 'parentUuid is required' }, { status: 400 });
  }

  const children = await prisma.$queryRawUnsafe<Array<{
    uuid: string;
    code: string;
    name: string;
    validation: string | null;
  }>>(
    `SELECT uuid::text, code, name, validation
     FROM financial_codes
     WHERE parent_uuid = $1::uuid AND is_active = true
     ORDER BY sort_order, code`,
    parentUuid
  );

  return NextResponse.json(children);
}
