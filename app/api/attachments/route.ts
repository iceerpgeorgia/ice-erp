import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/prisma';

export const revalidate = 0;

/**
 * GET /api/attachments
 * List all attachments with their links and related entity information
 * 
 * Query params:
 * - page: page number (default: 1)
 * - limit: items per page (default: 50)
 * - ownerTable: filter by owner table (optional)
 * - search: search in file names (optional)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Attachments API] Request received');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const ownerTable = searchParams.get('ownerTable');
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;
    console.log('[Attachments API] Params:', { page, limit, ownerTable, search, offset });

    // Build Prisma where clause
    const where: any = {
      is_active: true,
    };

    if (search) {
      where.file_name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Count total attachments
    const total = await withRetry(() => prisma.attachments.count({ where }));
    console.log('[Attachments API] Total count:', total);

    // Fetch attachments with basic info
    const attachments = await withRetry(() => prisma.attachments.findMany({
      where,
      include: {
        document_type: {
          select: {
            uuid: true,
            name: true,
            code: true,
          },
        },
        currency: {
          select: {
            uuid: true,
            code: true,
            name: true,
            symbol: true,
          },
        },
        attachment_links: ownerTable ? {
          where: {
            owner_table: ownerTable,
          },
          select: {
            uuid: true,
            owner_table: true,
            owner_uuid: true,
            owner_field: true,
            is_primary: true,
            created_at: true,
          },
        } : {
          select: {
            uuid: true,
            owner_table: true,
            owner_uuid: true,
            owner_field: true,
            is_primary: true,
            created_at: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    }));

    console.log('[Attachments API] Fetched attachments:', attachments.length);

    // Enrich links with entity details
    const enrichedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        const links = attachment.attachment_links || [];
        
        // Enrich each link with entity details
        const enrichedLinks = await Promise.all(
          links.map(async (link: any) => {
            let entityDetails = null;

            try {
              if (link.owner_table === 'projects') {
                const project = await prisma.projects.findFirst({
                  where: { project_uuid: link.owner_uuid },
                  select: {
                    project_uuid: true,
                    project_name: true,
                    contract_no: true,
                    counteragent: true,
                    date: true,
                  },
                });
                entityDetails = project;
              } else if (link.owner_table === 'payments') {
                const payment = await prisma.payments.findFirst({
                  where: { record_uuid: link.owner_uuid },
                  select: {
                    payment_id: true,
                    is_active: true,
                    income_tax: true,
                    label: true,
                    created_at: true,
                  },
                });
                entityDetails = payment;
              } else if (link.owner_table === 'jobs') {
                const job = await prisma.jobs.findFirst({
                  where: { job_uuid: link.owner_uuid },
                  select: {
                    job_uuid: true,
                    job_name: true,
                    floors: true,
                    weight: true,
                    is_ff: true,
                  },
                });
                entityDetails = job;
              } else if (link.owner_table === 'counteragents') {
                const counteragent = await prisma.counteragents.findFirst({
                  where: { counteragent_uuid: link.owner_uuid },
                  select: {
                    counteragent_uuid: true,
                    name: true,
                    identification_number: true,
                    entity_type: true,
                  },
                });
                entityDetails = counteragent;
              }
            } catch (error) {
              console.error(`[Attachments API] Error fetching entity for ${link.owner_table}:`, error);
            }

            return {
              link_uuid: link.uuid,
              owner_table: link.owner_table,
              owner_uuid: link.owner_uuid,
              owner_field: link.owner_field,
              is_primary: link.is_primary,
              created_at: link.created_at,
              entity_details: entityDetails,
            };
          })
        );

        return {
          uuid: attachment.uuid,
          fileName: attachment.file_name,
          mimeType: attachment.mime_type,
          fileSizeBytes: attachment.file_size_bytes ? Number(attachment.file_size_bytes) : null,
          fileHashSha256: attachment.file_hash_sha256,
          storageProvider: attachment.storage_provider,
          storageBucket: attachment.storage_bucket,
          storagePath: attachment.storage_path,
          documentType: attachment.document_type,
          documentDate: attachment.document_date,
          documentNo: attachment.document_no,
          documentValue: attachment.document_value ? parseFloat(attachment.document_value.toString()) : null,
          currency: attachment.currency,
          metadata: attachment.metadata,
          uploadedByUserId: attachment.uploaded_by_user_id,
          isActive: attachment.is_active,
          createdAt: attachment.created_at,
          updatedAt: attachment.updated_at,
          links: enrichedLinks,
        };
      })
    );

    console.log('[Attachments API] Returning:', enrichedAttachments.length, 'attachments');

    return NextResponse.json({
      attachments: enrichedAttachments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[Attachments API] Error:', error);
    console.error('[Attachments API] Stack:', error?.stack);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}
