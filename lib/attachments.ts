import { prisma } from '@/lib/prisma';
import { getSupabaseServer } from '@/lib/supabase';

export type AttachmentDto = {
  uuid: string;
  documentTypeUuid: string | null;
  documentDate: Date | null;
  documentNo: string | null;
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
  const links = await prisma.$queryRawUnsafe<any[]>(
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
  );

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
  userId?: string;
  metadata?: any;
  isPrimary?: boolean;
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
    userId,
    metadata,
    isPrimary = false,
  } = params;

  // Get payment record_uuid
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
       'supabase',
       $4,
       $5,
       $6,
       $7,
       $8,
       $9::jsonb,
       $10,
       true,
       NOW(),
       NOW()
     ) RETURNING uuid`,
    documentTypeUuid || null,
    documentDate || null,
    documentNo || null,
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
