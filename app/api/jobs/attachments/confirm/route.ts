import { NextRequest, NextResponse } from 'next/server';
import { createJobAttachment } from '@/lib/attachments';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

/**
 * POST /api/jobs/attachments/confirm
 * After the client PUTs the file via the signed URL, call this to create DB rows.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const body = await request.json();
    const {
      jobUuid,
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
      linkedProjectUuid,
    } = body;

    if (!jobUuid || !storagePath || !storageBucket || !fileName) {
      return NextResponse.json(
        { error: 'jobUuid, storagePath, storageBucket, and fileName are required' },
        { status: 400 },
      );
    }
    if (!documentTypeUuid) {
      return NextResponse.json(
        { error: 'documentTypeUuid is required' },
        { status: 400 },
      );
    }

    const userId = (auth as any)?.user?.id ?? null;

    const link = await createJobAttachment({
      jobUuid,
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
      linkedProjectUuid,
    });

    return NextResponse.json({
      success: true,
      linkUuid: link.uuid,
      attachmentUuid: link.attachmentUuid,
    });
  } catch (error: any) {
    console.error('Error confirming job attachment upload:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to confirm upload' },
      { status: 500 },
    );
  }
}
