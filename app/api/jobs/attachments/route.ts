import { NextRequest, NextResponse } from 'next/server';
import { getJobAttachments, getJobAttachmentCounts } from '@/lib/attachments';

export const revalidate = 0;

/**
 * GET /api/jobs/attachments?jobUuid=xxx
 *   → list attachments for a single job
 *
 * GET /api/jobs/attachments?jobUuids=u1,u2,...&countsOnly=1
 *   → bulk attachment counts per job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobUuid = searchParams.get('jobUuid');
    const jobUuidsCsv = searchParams.get('jobUuids');
    const countsOnly = searchParams.get('countsOnly');

    if (countsOnly && jobUuidsCsv) {
      const uuids = jobUuidsCsv.split(',').map((s) => s.trim()).filter(Boolean);
      const counts = await getJobAttachmentCounts(uuids);
      return NextResponse.json({ counts });
    }

    if (!jobUuid) {
      return NextResponse.json({ error: 'jobUuid is required' }, { status: 400 });
    }

    const attachments = await getJobAttachments(jobUuid);
    return NextResponse.json({
      jobUuid,
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
    console.error('Error fetching job attachments:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch job attachments' },
      { status: 500 },
    );
  }
}
