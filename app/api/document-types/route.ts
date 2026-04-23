import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

function serialize(dt: any) {
  return {
    id: String(dt.id),
    uuid: dt.uuid,
    name: dt.name,
    isActive: dt.is_active,
    createdAt: dt.created_at,
    updatedAt: dt.updated_at,
  };
}

/**
 * GET /api/document-types
 * Query params:
 *   - includeInactive=true : include inactive rows (default: only active)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const documentTypes = await prisma.document_types.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ documentTypes: documentTypes.map(serialize) });
  } catch (error: any) {
    console.error('Error fetching document types:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch document types' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/document-types
 * Body: { name: string, isActive?: boolean }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const isActive = body?.isActive !== false;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const existing = await prisma.document_types.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: `Document type "${name}" already exists` },
        { status: 409 }
      );
    }

    const created = await prisma.document_types.create({
      data: { uuid: randomUUID(), name, is_active: isActive },
    });

    await logAudit({
      table: 'document_types',
      recordId: created.uuid,
      action: 'create',
    });

    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error: any) {
    console.error('Error creating document type:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create document type' },
      { status: 500 }
    );
  }
}
