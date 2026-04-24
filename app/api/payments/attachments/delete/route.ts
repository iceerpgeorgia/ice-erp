import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseServer } from '@/lib/supabase';

/**
 * DELETE /api/payments/attachments/delete?linkUuid=xxx
 * Delete an attachment link and only remove storage when the last link is gone.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkUuid = searchParams.get('linkUuid');

    if (!linkUuid) {
      return NextResponse.json(
        { error: 'linkUuid is required' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{
        attachment_uuid: string;
        storage_bucket: string | null;
        storage_path: string;
      }>>(
        `SELECT al.attachment_uuid, a.storage_bucket, a.storage_path
         FROM attachment_links al
         JOIN attachments a ON a.uuid = al.attachment_uuid
         WHERE al.uuid = $1::uuid
         LIMIT 1`,
        linkUuid,
      );

      if (!rows[0]) {
        throw new Error('Attachment link not found');
      }

      const { attachment_uuid, storage_bucket, storage_path } = rows[0];

      await tx.$queryRawUnsafe(
        `DELETE FROM attachment_links WHERE uuid = $1::uuid`,
        linkUuid,
      );

      const remainingRows = await tx.$queryRawUnsafe<Array<{ cnt: bigint }>>(
        `SELECT COUNT(*)::bigint AS cnt
         FROM attachment_links
         WHERE attachment_uuid = $1::uuid`,
        attachment_uuid,
      );

      const deletedAttachment = Number(remainingRows[0]?.cnt ?? 0n) === 0;
      if (deletedAttachment) {
        await tx.$queryRawUnsafe(
          `DELETE FROM attachments WHERE uuid = $1::uuid`,
          attachment_uuid,
        );
      }

      return {
        deletedAttachment,
        storageBucket: storage_bucket,
        storagePath: storage_path,
      };
    });

    if (result.deletedAttachment && result.storageBucket && result.storagePath) {
      const supabase = getSupabaseServer();
      const { error } = await supabase.storage
        .from(result.storageBucket)
        .remove([result.storagePath]);

      if (error) {
        console.warn('Failed to delete file from storage:', error);
      }
    }

    return NextResponse.json({ success: true, deletedAttachment: result.deletedAttachment });
  } catch (error: any) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}