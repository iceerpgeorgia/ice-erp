import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { createPaymentAttachment } from '@/lib/attachments';

/**
 * POST /api/payments/attachments/upload
 * Upload an attachment for a payment
 * 
 * Body:
 * - paymentId: string (required)
 * - fileName: string (required)
 * - documentTypeUuid?: string
 * - isPrimary?: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId, fileName, documentTypeUuid, isPrimary } = body;

    if (!paymentId || !fileName) {
      return NextResponse.json(
        { error: 'paymentId and fileName are required' },
        { status: 400 }
      );
    }

    const bucket = 'payment-attachments';
    const fileSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `${paymentId}/${fileSuffix}-${fileName}`;

    const supabase = getSupabaseServer();
    
    // Create signed upload URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl || !data?.token) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create signed upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || storagePath,
      bucket,
      paymentId,
      fileName,
      documentTypeUuid,
      isPrimary,
    });
  } catch (error: any) {
    console.error('Error creating upload URL:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create upload URL' },
      { status: 500 }
    );
  }
}
