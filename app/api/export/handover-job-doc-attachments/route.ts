import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { prisma, withRetry } from '@/lib/prisma';
import { getSupabaseServer } from '@/lib/supabase';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIFT_CERT_DOC_TYPE_UUID = '77e8c811-3b1c-409d-a1e4-7cc40e1b0132';
const INSPECTION_INTERIM_UUID = '5eee6b9e-97b2-4a78-b442-355af1e9920c';

type DocAttachmentRow = {
  job_uuid: string;
  job_name: string | null;
  factory_no: string | null;
  document_no: string | null;
  file_name: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
};

function sanitizeFilePart(value: string | null | undefined, fallback: string): string {
  const normalized = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001F]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .slice(0, 120);

  return normalized.length > 0 ? normalized : fallback;
}

function getExtension(fileName: string | null | undefined): string {
  const raw = String(fileName || '');
  const idx = raw.lastIndexOf('.');
  if (idx <= 0 || idx === raw.length - 1) return '';
  const ext = raw.slice(idx).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

function createUniqueEntryName(
  row: DocAttachmentRow,
  usedNames: Set<string>,
): string {
  const jobName = sanitizeFilePart(row.job_name, 'Job');
  const factoryNo = sanitizeFilePart(row.factory_no, 'NoFactory');
  const docNo = sanitizeFilePart(row.document_no, 'NoDoc');
  const extension = getExtension(row.file_name);
  const baseName = `${jobName}_${factoryNo}_${docNo}`;

  let candidate = `${baseName}${extension}`;
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${baseName}_${counter}${extension}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

/**
 * POST /api/export/handover-job-doc-attachments
 * Body: { projectUuid: string }
 *
 * Builds a ZIP that contains all job attachments used by the Handovers Jobs table Doc. No column
 * (earliest lift certificate/interim inspection attachment per job).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const projectUuid = String(body?.projectUuid || '').trim();

    if (!projectUuid) {
      return NextResponse.json({ error: 'projectUuid is required' }, { status: 400 });
    }

    const project = await prisma.projects.findUnique({
      where: { project_uuid: projectUuid },
      select: {
        project_index: true,
        project_name: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rows = await withRetry(() =>
      prisma.$queryRawUnsafe<DocAttachmentRow[]>(
        `SELECT DISTINCT ON (j.job_uuid)
           j.job_uuid::text AS job_uuid,
           j.job_name,
           j.factory_no,
           a.document_no,
           a.file_name,
           a.storage_bucket,
           a.storage_path
         FROM jobs j
         JOIN job_projects jp
           ON jp.job_uuid = j.job_uuid
         JOIN attachment_links al
           ON al.owner_table = 'jobs'
          AND al.owner_uuid = j.job_uuid
         JOIN attachments a
           ON a.uuid = al.attachment_uuid
         WHERE jp.project_uuid = $1::uuid
           AND j.is_active = true
           AND a.is_active = true
           AND COALESCE(NULLIF(BTRIM(a.document_no), ''), NULL) IS NOT NULL
           AND a.document_type_uuid IN ($2::uuid, $3::uuid)
         ORDER BY j.job_uuid, a.document_date ASC NULLS LAST, a.created_at ASC NULLS LAST`,
        projectUuid,
        LIFT_CERT_DOC_TYPE_UUID,
        INSPECTION_INTERIM_UUID,
      ),
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: 'No Doc. No attachments found for this project' },
        { status: 404 },
      );
    }

    const supabase = getSupabaseServer();
    const zip = new JSZip();
    const usedNames = new Set<string>();

    let added = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.storage_path) {
        skipped += 1;
        continue;
      }

      const bucket = String(row.storage_bucket || 'payment-attachments').trim() || 'payment-attachments';
      const { data, error } = await supabase.storage.from(bucket).download(row.storage_path);

      if (error || !data) {
        console.error('[Handover Doc ZIP] Failed to download attachment:', {
          jobUuid: row.job_uuid,
          path: row.storage_path,
          bucket,
          error: error?.message || 'unknown error',
        });
        skipped += 1;
        continue;
      }

      const bytes = Buffer.from(await data.arrayBuffer());
      if (!bytes.length) {
        skipped += 1;
        continue;
      }

      const zipEntryName = createUniqueEntryName(row, usedNames);
      zip.file(zipEntryName, bytes);
      added += 1;
    }

    if (added === 0) {
      return NextResponse.json(
        { error: 'Attachments were found but none could be downloaded from storage' },
        { status: 404 },
      );
    }

    const zipBytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const today = new Date().toISOString().split('T')[0];
    const projectToken = sanitizeFilePart(project.project_index || project.project_name, 'project');
    const archiveName = `handover-doc-attachments-${projectToken}-${today}.zip`;

    const zipArrayBuffer = new ArrayBuffer(zipBytes.byteLength);
    new Uint8Array(zipArrayBuffer).set(zipBytes);

    return new NextResponse(zipArrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archiveName}"`,
        'Cache-Control': 'no-store',
        'X-Attachments-Added': String(added),
        'X-Attachments-Skipped': String(skipped),
      },
    });
  } catch (error: any) {
    console.error('POST /api/export/handover-job-doc-attachments error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to build attachments archive' },
      { status: 500 },
    );
  }
}
