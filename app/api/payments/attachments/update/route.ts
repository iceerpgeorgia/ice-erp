import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

/**
 * PATCH /api/payments/attachments/update
 * Update attachment metadata (document type, date, number, value, currency)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      attachmentUuid, 
      documentTypeUuid, 
      documentDate,
      documentNo,
      documentValue,
      documentCurrencyUuid
    } = body;

    if (!attachmentUuid) {
      return NextResponse.json(
        { error: 'attachmentUuid is required' },
        { status: 400 }
      );
    }

    if (!documentTypeUuid) {
      return NextResponse.json(
        { error: 'documentTypeUuid is required' },
        { status: 400 }
      );
    }

    if (!documentDate) {
      return NextResponse.json(
        { error: 'documentDate is required' },
        { status: 400 }
      );
    }

    // Update the attachment metadata
    const updatedAttachment = await prisma.attachments.update({
      where: { uuid: attachmentUuid },
      data: {
        document_type_uuid: documentTypeUuid,
        document_date: new Date(documentDate),
        document_no: documentNo || null,
        document_value: documentValue !== null && documentValue !== undefined ? documentValue : null,
        document_currency_uuid: documentCurrencyUuid || null,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      attachment: {
        uuid: updatedAttachment.uuid,
        documentTypeUuid: updatedAttachment.document_type_uuid,
        documentDate: updatedAttachment.document_date,
        documentNo: updatedAttachment.document_no,
        documentValue: updatedAttachment.document_value,
        documentCurrencyUuid: updatedAttachment.document_currency_uuid,
      },
    });
  } catch (error: any) {
    console.error('Error updating attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update attachment' },
      { status: 500 }
    );
  }
}
