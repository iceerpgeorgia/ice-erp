import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { createPaymentAttachment } from '@/lib/attachments';

/**
 * Sanitize filename for safe storage path
 * - Removes/replaces special characters
 * - Keeps only ASCII alphanumeric, dots, dashes, underscores
 * - Preserves file extension
 */
function sanitizeFileName(fileName: string): string {
  // Extract extension
  const lastDot = fileName.lastIndexOf('.');
  const name = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot) : '';
  
  // Replace spaces and special chars with dash, remove Unicode, keep only safe chars
  const safeName = name
    .replace(/\s+/g, '-')           // Replace spaces with dashes
    .replace(/[^\w.-]/g, '')        // Remove non-ASCII and special chars
    .replace(/--+/g, '-')           // Replace multiple dashes with single
    .replace(/^-+|-+$/g, '')        // Trim dashes from start/end
    .slice(0, 100);                 // Limit length
  
  // Use timestamp if name becomes empty after sanitization
  const finalName = safeName || `file-${Date.now()}`;
  
  return finalName + ext.toLowerCase();
}

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
    const { paymentId, fileName, documentTypeUuid, documentDate, isPrimary } = body;

    if (!paymentId || !fileName) {
      return NextResponse.json(
        { error: 'paymentId and fileName are required' },
        { status: 400 }
      );
    }

    const bucket = 'payment-attachments';
    const fileSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Sanitize filename for storage path (ASCII-safe)
    const sanitizedFileName = sanitizeFileName(fileName);
    const storagePath = `${paymentId}/${fileSuffix}-${sanitizedFileName}`;

    const supabase = getSupabaseServer();
    
    // Create signed upload URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl || !data?.token) {
      console.error('Supabase Storage error:', error);
      const errorMessage = error?.message || 'Failed to create signed upload URL';
      const hint = errorMessage.includes('not found') || errorMessage.includes('does not exist')
        ? ' The storage bucket "payment-attachments" may not exist. Please create it in the Supabase dashboard (Settings → Storage → New bucket → Name: payment-attachments, Public: OFF).'
        : '';
      
      return NextResponse.json(
        { error: errorMessage + hint },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || storagePath,
      bucket,
      paymentId,
      fileName, // Original filename for display
      sanitizedFileName, // Safe filename used in storage
      documentTypeUuid,
      documentDate,
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
