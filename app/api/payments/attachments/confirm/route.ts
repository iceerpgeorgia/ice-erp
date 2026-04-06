import { NextRequest, NextResponse } from 'next/server';
import { createPaymentAttachment } from '@/lib/attachments';

/**
 * POST /api/payments/attachments/confirm
 * Confirm attachment upload and create database records
 * 
 * Body:
 * - paymentId: string (required)
 * - storagePath: string (required)
 * - storageBucket: string (required)
 * - fileName: string (required)
 * - documentTypeUuid: string (required)
 * - documentDate: string (required)
 * - documentNo?: string
 * - documentValue?: number
 * - documentCurrencyUuid?: string
 * - mimeType?: string
 * - fileSizeBytes?: number
 * - userId?: string
 * - metadata?: any
 * - isPrimary?: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paymentId,
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
    } = body;

    if (!paymentId || !storagePath || !storageBucket || !fileName) {
      return NextResponse.json(
        { error: 'paymentId, storagePath, storageBucket, and fileName are required' },
        { status: 400 }
      );
    }

    if (!documentTypeUuid || !documentDate) {
      return NextResponse.json(
        { error: 'documentTypeUuid and documentDate are required' },
        { status: 400 }
      );
    }

    const link = await createPaymentAttachment({
      paymentId,
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
    console.error('Error confirming attachment upload:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to confirm attachment upload' },
      { status: 500 }
    );
  }
}
