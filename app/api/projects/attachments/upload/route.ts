import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

function sanitizeFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const name = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot) : '';
  const safeName = name
    .replace(/\s+/g, '-')
    .replace(/[^\w.-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  const finalName = safeName || `file-${Date.now()}`;
  return finalName + ext.toLowerCase();
}

/**
 * POST /api/projects/attachments/upload
 * Returns a signed URL the client uses to PUT the file directly to Supabase Storage.
 *
 * Body: { projectUuid, fileName, documentTypeUuid, documentDate, documentNo?, documentValue?, documentCurrencyUuid?, isPrimary? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const body = await request.json();
    const {
      projectUuid,
      fileName,
      documentTypeUuid,
      documentDate,
      documentNo,
      documentValue,
      documentCurrencyUuid,
      isPrimary,
    } = body;

    if (!projectUuid || !fileName) {
      return NextResponse.json({ error: 'projectUuid and fileName are required' }, { status: 400 });
    }
    if (!documentTypeUuid || !documentDate) {
      return NextResponse.json(
        { error: 'documentTypeUuid and documentDate are required' },
        { status: 400 },
      );
    }

    const bucket = 'payment-attachments';
    const fileSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sanitizedFileName = sanitizeFileName(fileName);
    const storagePath = `projects/${projectUuid}/${fileSuffix}-${sanitizedFileName}`;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl || !data?.token) {
      console.error('Supabase Storage error:', error);
      const errorMessage = error?.message || 'Failed to create signed upload URL';
      const hint =
        errorMessage.includes('not found') || errorMessage.includes('does not exist')
          ? ' The storage bucket "payment-attachments" may not exist. Create it in the Supabase dashboard.'
          : '';
      return NextResponse.json({ error: errorMessage + hint }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || storagePath,
      bucket,
      projectUuid,
      fileName,
      sanitizedFileName,
      documentTypeUuid,
      documentDate,
      documentNo,
      documentValue,
      documentCurrencyUuid,
      isPrimary,
    });
  } catch (error: any) {
    console.error('Error creating project attachment upload URL:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create upload URL' },
      { status: 500 },
    );
  }
}
