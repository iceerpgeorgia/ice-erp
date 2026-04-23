import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAttachmentDownloadUrl } from '@/lib/attachments';

/**
 * GET /api/public/payment-attachments?token=xxx
 * Public endpoint to view payment attachments via secure token
 * No authentication required - token-based access
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate token
    const tokenRecord = await prisma.paymentNotificationToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      );
    }

    // Check if token expired
    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 401 }
      );
    }

    // Get payment details first because attachment links store the payment record UUID.
    const payment = await prisma.payments.findUnique({
      where: { payment_id: tokenRecord.paymentId },
      select: {
        payment_id: true,
        label: true,
        created_at: true,
        record_uuid: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Get attachments for this payment
    const attachments = await prisma.attachments.findMany({
      where: {
        links: {
          some: {
            owner_table: 'payments',
            owner_uuid: payment.record_uuid,
          },
        },
        is_active: true,
      },
      include: {
        document_type: {
          select: {
            name: true,
          },
        },
        links: {
          where: {
            owner_table: 'payments',
            owner_uuid: payment.record_uuid,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Generate signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        let signedUrl = null;
        try {
          if (attachment.storage_bucket && attachment.storage_path) {
            signedUrl = await getAttachmentDownloadUrl(
              attachment.storage_bucket,
              attachment.storage_path,
              3600 // 1 hour expiry
            );
          }
        } catch (error) {
          console.error('Error generating signed URL:', error);
        }

        return {
          uuid: attachment.uuid,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
          fileSizeBytes: attachment.file_size_bytes?.toString(),
          documentDate: attachment.document_date,
          documentNo: attachment.document_no,
          documentValue: attachment.document_value?.toString(),
          documentType: attachment.document_type?.name,
          createdAt: attachment.created_at,
          downloadUrl: signedUrl,
        };
      })
    );

    return NextResponse.json({
      payment: {
        paymentId: payment.payment_id,
        label: payment.label,
        createdAt: payment.created_at,
      },
      attachments: attachmentsWithUrls,
      viewer: {
        name: tokenRecord.user.name,
        email: tokenRecord.user.email,
      },
      tokenExpiresAt: tokenRecord.expiresAt,
    });
  } catch (error: any) {
    console.error('[GET /api/public/payment-attachments] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve attachments' },
      { status: 500 }
    );
  }
}
