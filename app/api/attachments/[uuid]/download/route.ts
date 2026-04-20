import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { uuid: string } }
) {
  try {
    const { uuid } = params;

    // Fetch attachment from database
    const attachment = await prisma.attachments.findUnique({
      where: { uuid },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Download from Supabase Storage
    if (attachment.storage_provider === 'supabase') {
      const bucket = attachment.storage_bucket || 'payment-attachments';
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(attachment.storage_path);

      if (error) {
        console.error('Supabase download error:', error);
        return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
      }

      // Return file as downloadable response
      return new NextResponse(data, {
        headers: {
          'Content-Type': attachment.mime_type || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.file_name)}"`,
          'Content-Length': attachment.file_size_bytes?.toString() || '',
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported storage provider' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error downloading attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to download attachment' },
      { status: 500 }
    );
  }
}
