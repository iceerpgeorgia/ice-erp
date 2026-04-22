import { NextRequest, NextResponse } from 'next/server';
import { getProjectAttachments, getProjectAttachmentCounts } from '@/lib/attachments';

export const revalidate = 0;

/**
 * GET /api/projects/attachments?projectUuid=xxx
 *   → list attachments for a single project
 *
 * GET /api/projects/attachments?projectUuids=u1,u2,...&countsOnly=1
 *   → bulk attachment counts per project
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectUuid = searchParams.get('projectUuid');
    const projectUuidsCsv = searchParams.get('projectUuids');
    const countsOnly = searchParams.get('countsOnly');

    if (countsOnly && projectUuidsCsv) {
      const uuids = projectUuidsCsv.split(',').map((s) => s.trim()).filter(Boolean);
      const counts = await getProjectAttachmentCounts(uuids);
      return NextResponse.json({ counts });
    }

    if (!projectUuid) {
      return NextResponse.json({ error: 'projectUuid is required' }, { status: 400 });
    }

    const attachments = await getProjectAttachments(projectUuid);
    return NextResponse.json({
      projectUuid,
      attachments: attachments.map((link) => ({
        linkUuid: link.uuid,
        attachmentUuid: link.attachmentUuid,
        isPrimary: link.isPrimary,
        fileName: link.attachment?.fileName,
        mimeType: link.attachment?.mimeType,
        fileSizeBytes: link.attachment?.fileSizeBytes ? Number(link.attachment.fileSizeBytes) : null,
        storageBucket: link.attachment?.storageBucket,
        storagePath: link.attachment?.storagePath,
        documentTypeUuid: link.attachment?.documentTypeUuid,
        documentDate: link.attachment?.documentDate,
        documentNo: link.attachment?.documentNo,
        documentValue: link.attachment?.documentValue,
        documentCurrencyUuid: link.attachment?.documentCurrencyUuid,
        metadata: link.attachment?.metadata,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching project attachments:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch project attachments' },
      { status: 500 },
    );
  }
}
