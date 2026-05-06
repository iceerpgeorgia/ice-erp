import { NextRequest, NextResponse } from 'next/server';
import { getPaymentAttachmentCounts, getPaymentAttachments } from '@/lib/attachments';

export const revalidate = 0;

/**
 * GET /api/payments/attachments?paymentId=xxx
 * List attachments for a payment
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const paymentIdsCsv = searchParams.get('paymentIds');
    const countsOnly = searchParams.get('countsOnly');

    if (countsOnly && paymentIdsCsv) {
      const paymentIds = paymentIdsCsv.split(',').map((value) => value.trim()).filter(Boolean);
      const counts = await getPaymentAttachmentCounts(paymentIds);
      return NextResponse.json({ counts });
    }

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
        ownerTable: link.ownerTable,
        ownerUuid: link.ownerUuid,
        isPrimary: link.isPrimary,
        fileName: link.attachment?.fileName,
        mimeType: link.attachment?.mimeType,
        fileSizeBytes: link.attachment?.fileSizeBytes ? Number(link.attachment.fileSizeBytes) : null,
        storageBucket: link.attachment?.storageBucket,
        storagePath: link.attachment?.storagePath,
        documentTypeUuid: link.attachment?.documentTypeUuid,
        documentDate: link.attachment?.documentDate,
        documentNo: link.attachment?.documentNo,
        documentValue: link.attachment?.documentValue,
        documentCurrencyUuid: link.attachment?.documentCurrencyUuid,
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

/**
 * POST /api/payments/attachments
 * Body: { paymentIds: string[], countsOnly?: boolean }
 *
 * Used as a body-based alternative to GET when the paymentIds list is too large
 * for a query string (HTTP 414). Currently supports the counts-only mode used
 * by the payments report tables.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as
      | { paymentIds?: unknown; countsOnly?: unknown }
      | null;

    if (!body || !Array.isArray(body.paymentIds)) {
      return NextResponse.json(
        { error: 'paymentIds (string[]) is required' },
        { status: 400 }
      );
    }

    const paymentIds = body.paymentIds
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);

    if (body.countsOnly) {
      const counts = await getPaymentAttachmentCounts(paymentIds);
      return NextResponse.json({ counts });
    }

    return NextResponse.json(
      { error: 'Only countsOnly mode is supported via POST' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error fetching attachments (POST):', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}
