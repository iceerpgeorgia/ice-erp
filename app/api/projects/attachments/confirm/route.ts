import { NextRequest, NextResponse } from 'next/server';
import { createProjectAttachment } from '@/lib/attachments';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

/**
 * POST /api/projects/attachments/confirm
 * After the client PUTs the file via the signed URL, call this to create DB rows.
 *
 * Body: { projectUuid, storagePath, storageBucket, fileName, mimeType?, fileSizeBytes?,
 *         documentTypeUuid, documentDate, documentNo?, documentValue?, documentCurrencyUuid?, isPrimary? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const body = await request.json();
    const {
      projectUuid,
      storagePath,
      storageBucket,
      fileName,
      mimeType,
      fileSizeBytes,
      documentTypeUuid,
      documentDate,
      documentNo,
      documentValue,
      documentCurrencyUuid,
      metadata,
      isPrimary,
    } = body;

    if (!projectUuid || !storagePath || !storageBucket || !fileName) {
      return NextResponse.json(
        { error: 'projectUuid, storagePath, storageBucket, and fileName are required' },
        { status: 400 },
      );
    }
    if (!documentTypeUuid || !documentDate) {
      return NextResponse.json(
        { error: 'documentTypeUuid and documentDate are required' },
        { status: 400 },
      );
    }

    const userId = (auth as any)?.user?.id ?? null;

    const link = await createProjectAttachment({
      projectUuid,
      storagePath,
      storageBucket,
      fileName,
      mimeType,
      fileSizeBytes,
      documentTypeUuid,
      documentDate,
      documentNo,
      documentValue,
      documentCurrencyUuid,
      userId,
      metadata,
      isPrimary,
    });

    return NextResponse.json({
      success: true,
      linkUuid: link.uuid,
      attachmentUuid: link.attachmentUuid,
    });
  } catch (error: any) {
    console.error('Error confirming project attachment upload:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to confirm upload' },
      { status: 500 },
    );
  }
}
