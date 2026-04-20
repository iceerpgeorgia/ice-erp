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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const ownerTable = searchParams.get('ownerTable');
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions: string[] = ['a.is_active = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`a.file_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (ownerTable) {
      whereConditions.push(`al.owner_table = $${paramIndex}`);
      params.push(ownerTable);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Add limit and offset
    params.push(limit, offset);

    // Fetch attachments with all related data
    const attachments = await withRetry(() => prisma.$queryRawUnsafe<any[]>(
      `SELECT 
         a.id,
         a.uuid,
         a.document_type_uuid,
         a.document_date,
         a.document_no,
         a.document_value,
         a.document_currency_uuid,
         a.storage_provider,
         a.storage_bucket,
         a.storage_path,
         a.file_name,
         a.mime_type,
         a.file_size_bytes,
         a.file_hash_sha256,
         a.metadata,
         a.uploaded_by_user_id,
         a.is_active,
         a.created_at,
         a.updated_at,
         dt.name as document_type_name,
         dt.code as document_type_code,
         c.code as currency_code,
         c.name as currency_name,
         c.symbol as currency_symbol,
         json_agg(
           json_build_object(
             'link_uuid', al.uuid,
             'owner_table', al.owner_table,
             'owner_uuid', al.owner_uuid,
             'owner_field', al.owner_field,
             'is_primary', al.is_primary,
             'created_at', al.created_at
           )
         ) FILTER (WHERE al.uuid IS NOT NULL) as links
       FROM attachments a
       LEFT JOIN document_types dt ON dt.uuid = a.document_type_uuid
       LEFT JOIN currencies c ON c.uuid = a.document_currency_uuid
       LEFT JOIN attachment_links al ON al.attachment_uuid = a.uuid
       WHERE ${whereClause}
       GROUP BY a.id, a.uuid, a.document_type_uuid, a.document_date, a.document_no,
                a.document_value, a.document_currency_uuid, a.storage_provider,
                a.storage_bucket, a.storage_path, a.file_name, a.mime_type,
                a.file_size_bytes, a.file_hash_sha256, a.metadata,
                a.uploaded_by_user_id, a.is_active, a.created_at, a.updated_at,
                dt.name, dt.code, c.code, c.name, c.symbol
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...params
    ));

    // Get total count for pagination
    const countResult = await withRetry(() => prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(DISTINCT a.id) as total
       FROM attachments a
       LEFT JOIN attachment_links al ON al.attachment_uuid = a.uuid
       WHERE ${whereClause}`,
      ...params.slice(0, -2) // Remove limit and offset from count query
    ));

    const total = parseInt(countResult[0]?.total || '0');

    // Fetch related entity details for each link
    const enrichedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        const links = attachment.links || [];
        
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
              console.error(`Error fetching entity details for ${link.owner_table}:`, error);
            }

            return {
              ...link,
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
          documentType: attachment.document_type_uuid ? {
            uuid: attachment.document_type_uuid,
            name: attachment.document_type_name,
            code: attachment.document_type_code,
          } : null,
          documentDate: attachment.document_date,
          documentNo: attachment.document_no,
          documentValue: attachment.document_value ? parseFloat(attachment.document_value) : null,
          currency: attachment.document_currency_uuid ? {
            uuid: attachment.document_currency_uuid,
            code: attachment.currency_code,
            name: attachment.currency_name,
            symbol: attachment.currency_symbol,
          } : null,
          metadata: attachment.metadata,
          uploadedByUserId: attachment.uploaded_by_user_id,
          isActive: attachment.is_active,
          createdAt: attachment.created_at,
          updatedAt: attachment.updated_at,
          links: enrichedLinks,
        };
      })
    );

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
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}
