import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 0;

/**
 * Simplified attachments endpoint without entity enrichment
 * For debugging production issues
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Attachments Simple] Request received');
    
    const attachments = await prisma.attachments.findMany({
      where: { is_active: true },
      take: 50,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        uuid: true,
        file_name: true,
        mime_type: true,
        file_size_bytes: true,
        storage_provider: true,
        is_active: true,
        created_at: true,
      },
    });

    console.log(`[Attachments Simple] Found ${attachments.length} attachments`);

    // Convert BigInt to Number
    const serialized = attachments.map(a => ({
      id: Number(a.id),
      uuid: a.uuid,
      fileName: a.file_name,
      mimeType: a.mime_type,
      fileSizeBytes: a.file_size_bytes ? Number(a.file_size_bytes) : null,
      storageProvider: a.storage_provider,
      isActive: a.is_active,
      createdAt: a.created_at,
    }));

    return NextResponse.json({
      success: true,
      count: serialized.length,
      attachments: serialized,
    });
  } catch (error: any) {
    console.error('[Attachments Simple] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
