import { NextRequest, NextResponse } from 'next/server';
import { getPaymentAttachments } from '@/lib/attachments';

export const revalidate = 0;

/**
 * GET /api/payments/attachments?paymentId=xxx
 * List attachments for a payment
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json(
        { error: 'paymentId is required' },
        { status: 400 }
      );
    }

    const attachments = await getPaymentAttachments(paymentId);

    return NextResponse.json({
      paymentId,
      attachments: attachments.map((link) => ({
        linkUuid: link.uuid,
        attachmentUuid: link.attachmentUuid,
        isPrimary: link.isPrimary,
        fileName: link.attachment?.fileName,
        mimeType: link.attachment?.mimeType,
        fileSizeBytes: link.attachment?.fileSizeBytes ? Number(link.attachment.fileSizeBytes) : null,
        storageBucket: link.attachment?.storageBucket,
        storagePath: link.attachment?.storagePath,
        documentTypeUuid: link.attachment?.documentTypeUuid,
        metadata: link.attachment?.metadata,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}
