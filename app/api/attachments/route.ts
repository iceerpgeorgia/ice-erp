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
 * - all: when true, return all matching rows in a single response
 * - ownerTable: filter by owner table (optional)
 * - search: search in file names (optional)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Attachments API] Request received');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const all = ['1', 'true'].includes((searchParams.get('all') || '').toLowerCase());
    const requestedLimit = parseInt(searchParams.get('limit') || '50');
    const limit = all ? null : Math.min(requestedLimit, 200);
    const ownerTable = searchParams.get('ownerTable');
    const search = searchParams.get('search');
    const offset = all || limit == null ? 0 : (page - 1) * limit;
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

    if (ownerTable) {
      where.links = {
        some: {
          owner_table: ownerTable,
        },
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
          },
        },
        document_currency: {
          select: {
            uuid: true,
            code: true,
            name: true,
          },
        },
        links: ownerTable ? {
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
      ...(limit != null ? { take: limit, skip: offset } : {}),
    }));

    console.log('[Attachments API] Fetched attachments:', attachments.length);

    const links = attachments.flatMap((attachment) => attachment.links || []);
    const projectUuids = Array.from(new Set(
      links.filter((link: any) => link.owner_table === 'projects').map((link: any) => link.owner_uuid)
    ));
    const paymentUuids = Array.from(new Set(
      links.filter((link: any) => link.owner_table === 'payments').map((link: any) => link.owner_uuid)
    ));
    const jobUuids = Array.from(new Set(
      links.filter((link: any) => link.owner_table === 'jobs').map((link: any) => link.owner_uuid)
    ));
    const counteragentUuids = Array.from(new Set(
      links.filter((link: any) => link.owner_table === 'counteragents').map((link: any) => link.owner_uuid)
    ));
    const uploadedByUserIds = Array.from(new Set(
      attachments
        .map((attachment) => attachment.uploaded_by_user_id)
        .filter((userId): userId is string => Boolean(userId))
    ));

    const [projects, payments, jobs, counteragents, users] = await Promise.all([
      projectUuids.length > 0
        ? withRetry(() => prisma.projects.findMany({
            where: { project_uuid: { in: projectUuids } },
            select: {
              project_uuid: true,
              project_name: true,
              contract_no: true,
              counteragent: true,
              date: true,
            },
          }))
        : Promise.resolve([]),
      paymentUuids.length > 0
        ? withRetry(() => prisma.payments.findMany({
            where: { record_uuid: { in: paymentUuids } },
            select: {
              record_uuid: true,
              payment_id: true,
              is_active: true,
              income_tax: true,
              label: true,
              created_at: true,
              financial_code_uuid: true,
            },
          }))
        : Promise.resolve([]),
      jobUuids.length > 0
        ? withRetry(() => prisma.jobs.findMany({
            where: { job_uuid: { in: jobUuids } },
            select: {
              job_uuid: true,
              job_name: true,
              factory_no: true,
              floors: true,
              weight: true,
              is_ff: true,
            },
          }))
        : Promise.resolve([]),
      counteragentUuids.length > 0
        ? withRetry(() => prisma.counteragents.findMany({
            where: { counteragent_uuid: { in: counteragentUuids } },
            select: {
              counteragent_uuid: true,
              name: true,
              identification_number: true,
              entity_type: true,
            },
          }))
        : Promise.resolve([]),
      uploadedByUserIds.length > 0
        ? withRetry(() => prisma.user.findMany({
            where: { id: { in: uploadedByUserIds } },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          }))
        : Promise.resolve([]),
    ]);

    const financialCodeUuids = Array.from(new Set(
      payments
        .map((payment: any) => payment.financial_code_uuid)
        .filter((uuid: string | null): uuid is string => Boolean(uuid))
    ));
    const financialCodes = financialCodeUuids.length > 0
      ? await withRetry(() => prisma.financial_codes.findMany({
          where: { uuid: { in: financialCodeUuids } },
          select: {
            uuid: true,
            code: true,
            validation: true,
          },
        }))
      : [];

    const projectByUuid = new Map(projects.map((project: any) => [project.project_uuid, project]));
    const financialCodeByUuid = new Map(financialCodes.map((financialCode: any) => [financialCode.uuid, financialCode]));
    const paymentByUuid = new Map(
      payments.map((payment: any) => {
        const financialCode = payment.financial_code_uuid
          ? financialCodeByUuid.get(payment.financial_code_uuid)
          : null;
        return [
          payment.record_uuid,
          {
            ...payment,
            financial_code: financialCode?.code || null,
            financial_code_uuid: financialCode?.uuid || payment.financial_code_uuid || null,
          },
        ];
      })
    );
    const jobByUuid = new Map(jobs.map((job: any) => [job.job_uuid, job]));
    const counteragentByUuid = new Map(counteragents.map((counteragent: any) => [counteragent.counteragent_uuid, counteragent]));
    const userById = new Map(users.map((user: any) => [user.id, user]));

    const enrichedAttachments = attachments.map((attachment) => {
      const enrichedLinks = (attachment.links || []).map((link: any) => {
        let entityDetails = null;

        if (link.owner_table === 'projects') {
          entityDetails = projectByUuid.get(link.owner_uuid) || null;
        } else if (link.owner_table === 'payments') {
          entityDetails = paymentByUuid.get(link.owner_uuid) || null;
        } else if (link.owner_table === 'jobs') {
          entityDetails = jobByUuid.get(link.owner_uuid) || null;
        } else if (link.owner_table === 'counteragents') {
          entityDetails = counteragentByUuid.get(link.owner_uuid) || null;
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
      });

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
        currency: attachment.document_currency,
        metadata: attachment.metadata,
        uploadedByUserId: attachment.uploaded_by_user_id,
        uploadedByUser: attachment.uploaded_by_user_id ? userById.get(attachment.uploaded_by_user_id) || null : null,
        isActive: attachment.is_active,
        createdAt: attachment.created_at,
        updatedAt: attachment.updated_at,
        links: enrichedLinks,
      };
    });

    console.log('[Attachments API] Returning:', enrichedAttachments.length, 'attachments');

    return NextResponse.json({
      attachments: enrichedAttachments,
      pagination: {
        page: all ? 1 : page,
        limit: all ? enrichedAttachments.length : limit,
        total,
        totalPages: all || !limit ? 1 : Math.ceil(total / limit),
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
