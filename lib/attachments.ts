import { prisma, withRetry } from '@/lib/prisma';
import { getSupabaseServer } from '@/lib/supabase';

export type AttachmentDto = {
  uuid: string;
  documentTypeUuid: string | null;
  documentDate: Date | null;
  documentNo: string | null;
  documentValue: number | null;
  documentCurrencyUuid: string | null;
  storageProvider: string;
  storageBucket: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: bigint | null;
  fileHashSha256: string | null;
  metadata: any;
  uploadedByUserId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AttachmentLinkDto = {
  uuid: string;
  attachmentUuid: string;
  ownerTable: string;
  ownerUuid: string;
  ownerField: string | null;
  isPrimary: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachment?: AttachmentDto;
};

/**
 * Get attachments for a specific payment_id
 */
export async function getPaymentAttachments(paymentId: string): Promise<AttachmentLinkDto[]> {
  const links = await withRetry(() => prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       al.uuid,
       al.attachment_uuid,
       al.owner_table,
       al.owner_uuid,
       al.owner_field,
       al.is_primary,
       al.created_by_user_id,
       al.created_at,
       al.updated_at,
       a.uuid as attachment_uuid,
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
       a.created_at as attachment_created_at,
       a.updated_at as attachment_updated_at
     FROM attachment_links al
     JOIN attachments a ON a.uuid = al.attachment_uuid
     WHERE al.owner_table = 'payments'
       AND al.owner_uuid = (SELECT record_uuid FROM payments WHERE payment_id = $1 LIMIT 1)::uuid
       AND a.is_active = true
     ORDER BY al.is_primary DESC, al.created_at DESC`,
    paymentId
  ));

  return links.map((link) => ({
    uuid: link.uuid,
    attachmentUuid: link.attachment_uuid,
    ownerTable: link.owner_table,
    ownerUuid: link.owner_uuid,
    ownerField: link.owner_field,
    isPrimary: link.is_primary,
    createdByUserId: link.created_by_user_id,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    attachment: {
      uuid: link.attachment_uuid,
      documentTypeUuid: link.document_type_uuid,
      documentDate: link.document_date,
      documentNo: link.document_no,
      documentValue: link.document_value ? parseFloat(link.document_value) : null,
      documentCurrencyUuid: link.document_currency_uuid,
      storageProvider: link.storage_provider,
      storageBucket: link.storage_bucket,
      storagePath: link.storage_path,
      fileName: link.file_name,
      mimeType: link.mime_type,
      fileSizeBytes: link.file_size_bytes,
      fileHashSha256: link.file_hash_sha256,
      metadata: link.metadata,
      uploadedByUserId: link.uploaded_by_user_id,
      isActive: link.is_active,
      createdAt: link.attachment_created_at,
      updatedAt: link.attachment_updated_at,
    },
  }));
}

/**
 * Create attachment and link it to a payment
 */
export async function createPaymentAttachment(params: {
  paymentId: string;
  storagePath: string;
  storageBucket: string;
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  documentTypeUuid?: string;
  documentDate?: string;
  documentNo?: string;
  documentValue?: number;
  documentCurrencyUuid?: string;
  userId?: string;
  metadata?: any;
  isPrimary?: boolean;
  linkedProjectUuid?: string;
}): Promise<AttachmentLinkDto> {
  const {
    paymentId,
    storagePath,
    storageBucket,
    fileName,
    mimeType,
    fileSizeBytes,
    documentTypeUuid,
    documentDate,
    documentNo,
    documentValue,
    documentCurrencyUuid,
    userId,
    metadata,
    isPrimary = false,
    linkedProjectUuid,
  } = params;
  const payment = await prisma.$queryRawUnsafe<Array<{ record_uuid: string }>>(
    `SELECT record_uuid FROM payments WHERE payment_id = $1 LIMIT 1`,
    paymentId
  );

  if (!payment || payment.length === 0) {
    throw new Error('Payment not found');
  }

  const recordUuid = payment[0].record_uuid;

  // Create attachment
  const attachmentResult = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO attachments (
       uuid,
       document_type_uuid,
       document_date,
       document_no,
       document_value,
       document_currency_uuid,
       storage_provider,
       storage_bucket,
       storage_path,
       file_name,
       mime_type,
       file_size_bytes,
       metadata,
       uploaded_by_user_id,
       is_active,
       created_at,
       updated_at
     ) VALUES (
       gen_random_uuid(),
       $1::uuid,
       $2::timestamp,
       $3,
       $4::decimal,
       $5::uuid,
       'supabase',
       $6,
       $7,
       $8,
       $9,
       $10,
       $11::jsonb,
       $12,
       true,
       NOW(),
       NOW()
     ) RETURNING uuid`,
    documentTypeUuid || null,
    documentDate || null,
    documentNo || null,
    documentValue || null,
    documentCurrencyUuid || null,
    storageBucket,
    storagePath,
    fileName,
    mimeType || null,
    fileSizeBytes || null,
    metadata ? JSON.stringify(metadata) : null,
    userId || null
  );

  const attachmentUuid = attachmentResult[0].uuid;

  // Create attachment_link
  const linkResult = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO attachment_links (
       uuid,
       attachment_uuid,
       owner_table,
       owner_uuid,
       owner_field,
       is_primary,
       created_by_user_id,
       created_at,
       updated_at
     ) VALUES (
       gen_random_uuid(),
       $1::uuid,
       'payments',
       $2::uuid,
       'payment_id',
       $3,
       $4,
       NOW(),
       NOW()
     ) RETURNING uuid`,
    attachmentUuid,
    recordUuid,
    isPrimary,
    userId || null
  );

  // Optionally also link to a project
  if (linkedProjectUuid) {
    await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO attachment_links (uuid, attachment_uuid, owner_table, owner_uuid, owner_field, is_primary, created_by_user_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::uuid, 'projects', $2::uuid, NULL, false, $3, NOW(), NOW())`,
      attachmentUuid,
      linkedProjectUuid,
      userId || null,
    );
  }

  // Return full link with attachment
  const links = await getPaymentAttachments(paymentId);
  return links.find((link) => link.uuid === linkResult[0].uuid)!;
}

/**
 * Delete attachment link (and orphaned attachment)
 */
export async function deletePaymentAttachment(attachmentLinkUuid: string): Promise<void> {
  await prisma.$queryRawUnsafe(
    `DELETE FROM attachment_links WHERE uuid = $1::uuid`,
    attachmentLinkUuid
  );
  // Cascade delete on attachments table will handle orphaned attachments
}

/**
 * Get a signed download URL from Supabase Storage
 */
export async function getAttachmentDownloadUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Failed to create signed download URL');
  }

  return data.signedUrl;
}

/**
 * Update attachment metadata or document type
 */
export async function updateAttachment(
  attachmentUuid: string,
  updates: {
    documentTypeUuid?: string | null;
    fileName?: string;
    metadata?: any;
  }
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.documentTypeUuid !== undefined) {
    sets.push(`document_type_uuid = $${paramIndex}::uuid`);
    values.push(updates.documentTypeUuid);
    paramIndex++;
  }
  if (updates.fileName !== undefined) {
    sets.push(`file_name = $${paramIndex}`);
    values.push(updates.fileName);
    paramIndex++;
  }
  if (updates.metadata !== undefined) {
    sets.push(`metadata = $${paramIndex}::jsonb`);
    values.push(JSON.stringify(updates.metadata));
    paramIndex++;
  }

  if (sets.length === 0) return;

  sets.push(`updated_at = NOW()`);
  values.push(attachmentUuid);

  await prisma.$queryRawUnsafe(
    `UPDATE attachments SET ${sets.join(', ')} WHERE uuid = $${paramIndex}::uuid`,
    ...values
  );
}

// ---------------------------------------------------------------------------
// Project attachments (owner_table='projects', owner_uuid=projects.project_uuid)
// ---------------------------------------------------------------------------

const PROJECT_LINK_SELECT = `
  SELECT
    al.uuid,
    al.attachment_uuid,
    al.owner_table,
    al.owner_uuid,
    al.owner_field,
    al.is_primary,
    al.created_by_user_id,
    al.created_at,
    al.updated_at,
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
    a.created_at AS attachment_created_at,
    a.updated_at AS attachment_updated_at
  FROM attachment_links al
  JOIN attachments a ON a.uuid = al.attachment_uuid
  WHERE al.owner_table = 'projects'
    AND a.is_active = true
`;

function mapLinkRow(link: any): AttachmentLinkDto {
  return {
    uuid: link.uuid,
    attachmentUuid: link.attachment_uuid,
    ownerTable: link.owner_table,
    ownerUuid: link.owner_uuid,
    ownerField: link.owner_field,
    isPrimary: link.is_primary,
    createdByUserId: link.created_by_user_id,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    attachment: {
      uuid: link.attachment_uuid,
      documentTypeUuid: link.document_type_uuid,
      documentDate: link.document_date,
      documentNo: link.document_no,
      documentValue: link.document_value != null ? parseFloat(link.document_value) : null,
      documentCurrencyUuid: link.document_currency_uuid,
      storageProvider: link.storage_provider,
      storageBucket: link.storage_bucket,
      storagePath: link.storage_path,
      fileName: link.file_name,
      mimeType: link.mime_type,
      fileSizeBytes: link.file_size_bytes,
      fileHashSha256: link.file_hash_sha256,
      metadata: link.metadata,
      uploadedByUserId: link.uploaded_by_user_id,
      isActive: link.is_active,
      createdAt: link.attachment_created_at,
      updatedAt: link.attachment_updated_at,
    },
  };
}

/**
 * Get attachments linked to a project (owner_table='projects').
 */
export async function getProjectAttachments(projectUuid: string): Promise<AttachmentLinkDto[]> {
  const links = await withRetry(() => prisma.$queryRawUnsafe<any[]>(
    `${PROJECT_LINK_SELECT}
       AND al.owner_uuid = $1::uuid
     ORDER BY al.is_primary DESC, al.created_at DESC`,
    projectUuid
  ));
  return links.map(mapLinkRow);
}

/**
 * Bulk fetch: count of project attachments per projectUuid.
 * Returns { [projectUuid]: count }.
 */
export async function getProjectAttachmentCounts(projectUuids: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(projectUuids.filter((v) => typeof v === 'string' && v.length > 0)));
  if (unique.length === 0) return {};
  // Build $1::uuid, $2::uuid ... placeholders
  const placeholders = unique.map((_, i) => `$${i + 1}::uuid`).join(', ');
  const rows = await withRetry(() => prisma.$queryRawUnsafe<Array<{ owner_uuid: string; cnt: bigint }>>(
    `SELECT al.owner_uuid::text AS owner_uuid, COUNT(*)::bigint AS cnt
     FROM attachment_links al
     JOIN attachments a ON a.uuid = al.attachment_uuid
     WHERE al.owner_table = 'projects'
       AND a.is_active = true
       AND al.owner_uuid IN (${placeholders})
     GROUP BY al.owner_uuid`,
    ...unique
  ));
  const out: Record<string, number> = {};
  for (const u of unique) out[u] = 0;
  for (const r of rows) out[r.owner_uuid] = Number(r.cnt);
  return out;
}

/**
 * Create attachment row + link to a project.
 */
export async function createProjectAttachment(params: {
  projectUuid: string;
  storagePath: string;
  storageBucket: string;
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  documentTypeUuid?: string;
  documentDate?: string;
  documentNo?: string;
  documentValue?: number;
  documentCurrencyUuid?: string;
  userId?: string;
  metadata?: any;
  isPrimary?: boolean;
}): Promise<AttachmentLinkDto> {
  const {
    projectUuid,
    storagePath,
    storageBucket,
    fileName,
    mimeType,
    fileSizeBytes,
    documentTypeUuid,
    documentDate,
    documentNo,
    documentValue,
    documentCurrencyUuid,
    userId,
    metadata,
    isPrimary = false,
  } = params;

  // Validate the project exists
  const project = await prisma.$queryRawUnsafe<Array<{ project_uuid: string }>>(
    `SELECT project_uuid::text AS project_uuid FROM projects WHERE project_uuid = $1::uuid LIMIT 1`,
    projectUuid
  );
  if (!project || project.length === 0) {
    throw new Error('Project not found');
  }

  const attachmentResult = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `INSERT INTO attachments (
       uuid, document_type_uuid, document_date, document_no, document_value,
       document_currency_uuid, storage_provider, storage_bucket, storage_path,
       file_name, mime_type, file_size_bytes, metadata, uploaded_by_user_id,
       is_active, created_at, updated_at
     ) VALUES (
       gen_random_uuid(), $1::uuid, $2::timestamp, $3, $4::decimal,
       $5::uuid, 'supabase', $6, $7,
       $8, $9, $10, $11::jsonb, $12,
       true, NOW(), NOW()
     ) RETURNING uuid`,
    documentTypeUuid || null,
    documentDate || null,
    documentNo || null,
    documentValue ?? null,
    documentCurrencyUuid || null,
    storageBucket,
    storagePath,
    fileName,
    mimeType || null,
    fileSizeBytes || null,
    metadata ? JSON.stringify(metadata) : null,
    userId || null,
  );

  const attachmentUuid = attachmentResult[0].uuid;

  const linkResult = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `INSERT INTO attachment_links (
       uuid, attachment_uuid, owner_table, owner_uuid, owner_field,
       is_primary, created_by_user_id, created_at, updated_at
     ) VALUES (
       gen_random_uuid(), $1::uuid, 'projects', $2::uuid, NULL,
       $3, $4, NOW(), NOW()
     ) RETURNING uuid`,
    attachmentUuid,
    projectUuid,
    isPrimary,
    userId || null,
  );

  const links = await getProjectAttachments(projectUuid);
  return links.find((link) => link.uuid === linkResult[0].uuid)!;
}

/**
 * Generic delete by attachment_links.uuid. Cascade removes orphaned attachment rows.
 * (Same operation as deletePaymentAttachment — exposed as a generic name.)
 */
export async function deleteAttachmentLink(attachmentLinkUuid: string): Promise<void> {
  await prisma.$queryRawUnsafe(
    `DELETE FROM attachment_links WHERE uuid = $1::uuid`,
    attachmentLinkUuid
  );
}

// ---------------------------------------------------------------------------
// Job attachments (owner_table='jobs', owner_uuid=jobs.job_uuid)
// ---------------------------------------------------------------------------

const JOB_LINK_SELECT = PROJECT_LINK_SELECT.replace(
  "WHERE al.owner_table = 'projects'",
  "WHERE al.owner_table = 'jobs'"
);

/** Get attachments linked to a job (owner_table='jobs'). */
export async function getJobAttachments(jobUuid: string): Promise<AttachmentLinkDto[]> {
  const links = await withRetry(() => prisma.$queryRawUnsafe<any[]>(
    `${JOB_LINK_SELECT}
       AND al.owner_uuid = $1::uuid
     ORDER BY al.is_primary DESC, al.created_at DESC`,
    jobUuid
  ));
  return links.map(mapLinkRow);
}

/** Bulk fetch: count of job attachments per jobUuid. */
export async function getJobAttachmentCounts(jobUuids: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(jobUuids.filter((v) => typeof v === 'string' && v.length > 0)));
  if (unique.length === 0) return {};
  const placeholders = unique.map((_, i) => `$${i + 1}::uuid`).join(', ');
  const rows = await withRetry(() => prisma.$queryRawUnsafe<Array<{ owner_uuid: string; cnt: bigint }>>(
    `SELECT al.owner_uuid::text AS owner_uuid, COUNT(*)::bigint AS cnt
     FROM attachment_links al
     JOIN attachments a ON a.uuid = al.attachment_uuid
     WHERE al.owner_table = 'jobs'
       AND a.is_active = true
       AND al.owner_uuid IN (${placeholders})
     GROUP BY al.owner_uuid`,
    ...unique
  ));
  const out: Record<string, number> = {};
  for (const u of unique) out[u] = 0;
  for (const r of rows) out[r.owner_uuid] = Number(r.cnt);
  return out;
}

/** Create attachment row + link to a job. */
export async function createJobAttachment(params: {
  jobUuid: string;
  storagePath: string;
  storageBucket: string;
  fileName: string;
  mimeType?: string;
  fileSizeBytes?: number;
  documentTypeUuid?: string;
  documentDate?: string;
  documentNo?: string;
  documentValue?: number;
  documentCurrencyUuid?: string;
  userId?: string;
  metadata?: any;
  isPrimary?: boolean;
  linkedProjectUuid?: string;
}): Promise<AttachmentLinkDto> {
  const {
    jobUuid,
    storagePath,
    storageBucket,
    fileName,
    mimeType,
    fileSizeBytes,
    documentTypeUuid,
    documentDate,
    documentNo,
    documentValue,
    documentCurrencyUuid,
    userId,
    metadata,
    isPrimary = false,
    linkedProjectUuid,
  } = params;

  // Validate the job exists
  const job = await prisma.$queryRawUnsafe<Array<{ job_uuid: string }>>(
    `SELECT job_uuid::text AS job_uuid FROM jobs WHERE job_uuid = $1::uuid LIMIT 1`,
    jobUuid
  );
  if (!job || job.length === 0) {
    throw new Error('Job not found');
  }

  const attachmentResult = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `INSERT INTO attachments (
       uuid, document_type_uuid, document_date, document_no, document_value,
       document_currency_uuid, storage_provider, storage_bucket, storage_path,
       file_name, mime_type, file_size_bytes, metadata, uploaded_by_user_id,
       is_active, created_at, updated_at
     ) VALUES (
       gen_random_uuid(), $1::uuid, $2::timestamp, $3, $4::decimal,
       $5::uuid, 'supabase', $6, $7,
       $8, $9, $10, $11::jsonb, $12,
       true, NOW(), NOW()
     ) RETURNING uuid`,
    documentTypeUuid || null,
    documentDate || null,
    documentNo || null,
    documentValue ?? null,
    documentCurrencyUuid || null,
    storageBucket,
    storagePath,
    fileName,
    mimeType || null,
    fileSizeBytes || null,
    metadata ? JSON.stringify(metadata) : null,
    userId || null,
  );

  const attachmentUuid = attachmentResult[0].uuid;

  const linkResult = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `INSERT INTO attachment_links (
       uuid, attachment_uuid, owner_table, owner_uuid, owner_field,
       is_primary, created_by_user_id, created_at, updated_at
     ) VALUES (
       gen_random_uuid(), $1::uuid, 'jobs', $2::uuid, NULL,
       $3, $4, NOW(), NOW()
     ) RETURNING uuid`,
    attachmentUuid,
    jobUuid,
    isPrimary,
    userId || null,
  );

  // Optionally also link to a project
  if (linkedProjectUuid) {
    await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO attachment_links (uuid, attachment_uuid, owner_table, owner_uuid, owner_field, is_primary, created_by_user_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::uuid, 'projects', $2::uuid, NULL, false, $3, NOW(), NOW())`,
      attachmentUuid,
      linkedProjectUuid,
      userId || null,
    );
  }

  const links = await getJobAttachments(jobUuid);
  return links.find((link) => link.uuid === linkResult[0].uuid)!;
}
