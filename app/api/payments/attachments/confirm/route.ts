import { NextRequest, NextResponse } from 'next/server';
import { createPaymentAttachment } from '@/lib/attachments';
import { sendPaymentNotifications } from '@/lib/payment-notifications';
import { prisma } from '@/lib/prisma';

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
      linkedProjectUuid,
    } = body;

    if (!paymentId || !storagePath || !storageBucket || !fileName) {
      return NextResponse.json(
        { error: 'paymentId, storagePath, storageBucket, and fileName are required' },
        { status: 400 }
      );
    }

    if (!documentTypeUuid) {
      return NextResponse.json(
        { error: 'documentTypeUuid is required' },
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
      linkedProjectUuid,
    });

    // Send payment notifications asynchronously when attachment is added
    prisma.payments.findUnique({
      where: { payment_id: paymentId },
      select: { payment_id: true, label: true },
    }).then(payment => {
      if (payment) {
        // Count total attachments
        prisma.attachments.count({
          where: {
            links: {
              some: {
                owner_table: 'payments',
                owner_uuid: paymentId,
              },
            },
            is_active: true,
          },
        }).then(attachmentCount => {
          sendPaymentNotifications({
            paymentId: payment.payment_id,
            label: payment.label,
            attachmentCount,
          }).catch(err => {
            console.error('[Attachment Confirm] Error sending notifications:', err);
          });
        }).catch(err => {
          console.error('[Attachment Confirm] Error counting attachments:', err);
        });
      }
    }).catch(err => {
      console.error('[Attachment Confirm] Error fetching payment:', err);
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
