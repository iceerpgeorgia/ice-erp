import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/attachments/:uuid
 * Lightweight metadata fetch (used after edits, etc).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;
    const attachment = await prisma.attachments.findUnique({
      where: { uuid },
      include: {
        document_type: { select: { uuid: true, name: true } },
        document_currency: { select: { uuid: true, code: true, name: true } },
      },
    });
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    return NextResponse.json({
      ...attachment,
      id: String(attachment.id),
      file_size_bytes: attachment.file_size_bytes != null ? String(attachment.file_size_bytes) : null,
    });
  } catch (error: any) {
    console.error('Error fetching attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch attachment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attachments/:uuid
 *
 * Behavior:
 *  - Default (soft delete): sets attachments.is_active = false. Storage object is preserved.
 *  - ?hard=true            : also removes all attachment_links for this attachment and
 *                            deletes the storage object. Use only when you want a full purge.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const { uuid } = params;
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    const attachment = await prisma.attachments.findUnique({ where: { uuid } });
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    if (!hard) {
      const updated = await prisma.attachments.update({
        where: { uuid },
        data: { is_active: false },
      });
      return NextResponse.json({
        deleted: false,
        deactivated: true,
        attachment: { uuid: updated.uuid, isActive: updated.is_active },
      });
    }

    // Hard delete: links → storage → row
    await prisma.attachment_links.deleteMany({ where: { attachment_uuid: uuid } });

    if (attachment.storage_provider === 'supabase') {
      const bucket = attachment.storage_bucket || 'payment-attachments';
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([attachment.storage_path]);
      if (storageError) {
        console.warn('Storage object delete failed (continuing with DB delete):', storageError);
      }
    }

    await prisma.attachments.delete({ where: { uuid } });

    return NextResponse.json({ deleted: true, hard: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
