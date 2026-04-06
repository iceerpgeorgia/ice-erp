import { NextRequest, NextResponse } from 'next/server';
import { getAttachmentDownloadUrl } from '@/lib/attachments';

/**
 * GET /api/payments/attachments/download?bucket=xxx&path=xxx
 * Get a signed download URL for an attachment
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const path = searchParams.get('path');
    const expiresIn = Number(searchParams.get('expiresIn') || '3600');

    if (!bucket || !path) {
      return NextResponse.json(
        { error: 'bucket and path are required' },
        { status: 400 }
      );
    }

    const signedUrl = await getAttachmentDownloadUrl(bucket, path, expiresIn);

    return NextResponse.json({ signedUrl });
  } catch (error: any) {
    console.error('Error creating download URL:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create download URL' },
      { status: 500 }
    );
  }
}
