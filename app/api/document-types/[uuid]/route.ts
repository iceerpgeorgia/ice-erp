import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

function serialize(dt: any) {
  return {
    id: String(dt.id),
    uuid: dt.uuid,
    name: dt.name,
    isActive: dt.is_active,
    requireDate: dt.require_date ?? false,
    requireValue: dt.require_value ?? false,
    requireCurrency: dt.require_currency ?? false,
    requireDocumentNo: dt.require_document_no ?? false,
    requireProject: dt.require_project ?? false,
    createdAt: dt.created_at,
    updatedAt: dt.updated_at,
  };
}

/**
 * PATCH /api/document-types/:uuid
 * Body: { name?: string, isActive?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const { uuid } = params;
    const body = await request.json();

    const data: { name?: string; is_active?: boolean; require_date?: boolean; require_value?: boolean; require_currency?: boolean; require_document_no?: boolean; require_project?: boolean } = {};
    if (typeof body?.name === 'string') {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      }
      // Check uniqueness conflict
      const conflict = await prisma.document_types.findFirst({
        where: { name, NOT: { uuid } },
      });
      if (conflict) {
        return NextResponse.json(
          { error: `Document type "${name}" already exists` },
          { status: 409 }
        );
      }
      data.name = name;
    }
    if (typeof body?.isActive === 'boolean') data.is_active = body.isActive;
    if (typeof body?.requireDate === 'boolean') data.require_date = body.requireDate;
    if (typeof body?.requireValue === 'boolean') data.require_value = body.requireValue;
    if (typeof body?.requireCurrency === 'boolean') data.require_currency = body.requireCurrency;
    if (typeof body?.requireDocumentNo === 'boolean') data.require_document_no = body.requireDocumentNo;
    if (typeof body?.requireProject === 'boolean') data.require_project = body.requireProject;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.document_types.update({
      where: { uuid },
      data,
    });

    await logAudit({
      table: 'document_types',
      recordId: uuid,
      action: 'update',
    });

    return NextResponse.json(serialize(updated));
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    }
    console.error('Error updating document type:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update document type' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/document-types/:uuid
 * Soft-delete by setting is_active=false if document type is referenced by attachments,
 * otherwise hard delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const { uuid } = params;

    const inUse = await prisma.attachments.count({
      where: { document_type_uuid: uuid },
    });

    if (inUse > 0) {
      // Soft delete: deactivate so existing attachments retain reference
      const updated = await prisma.document_types.update({
        where: { uuid },
        data: { is_active: false },
      });
      await logAudit({
        table: 'document_types',
        recordId: uuid,
        action: 'deactivate',
      });
      return NextResponse.json({
        deactivated: true,
        message: `Document type is used by ${inUse} attachment(s); deactivated instead of deleted.`,
        documentType: serialize(updated),
      });
    }

    await prisma.document_types.delete({ where: { uuid } });
    await logAudit({
      table: 'document_types',
      recordId: uuid,
      action: 'delete',
    });

    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Document type not found' }, { status: 404 });
    }
    console.error('Error deleting document type:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete document type' },
      { status: 500 }
    );
  }
}
