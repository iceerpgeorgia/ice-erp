import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/attachments/:uuid/view
 * Same as /download but uses `Content-Disposition: inline` so the browser
 * renders supported file types (PDF, images, text) directly instead of
 * forcing a download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;

    const attachment = await prisma.attachments.findUnique({
      where: { uuid },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    if (attachment.storage_provider !== 'supabase') {
      return NextResponse.json(
        { error: 'Unsupported storage provider' },
        { status: 400 }
      );
    }

    const bucket = attachment.storage_bucket || 'payment-attachments';
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(attachment.storage_path);

    if (error) {
      console.error('Supabase view error:', error);
      return NextResponse.json({ error: 'Failed to load file' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    return new NextResponse(data, {
      headers: {
        'Content-Type': attachment.mime_type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.file_name)}"`,
        'Content-Length': attachment.file_size_bytes?.toString() || '',
        // Prevent caching by other users — file URLs are user-scoped.
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error viewing attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to view attachment' },
      { status: 500 }
    );
  }
}
