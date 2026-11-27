import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { getAttachmentDownloadUrl } from '@/lib/attachments';

export const dynamic = 'force-dynamic';

// Long enough for a slow viewer; the tab never keeps it, because reloading this page signs again.
const LINK_SECONDS = 6 * 3600;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const isInline = (mime: string | null) => !!mime && (mime === 'application/pdf' || mime.startsWith('image/') || mime.startsWith('text/'));

/**
 * GET /api/attachments/:uuid/open — the address the app opens to view an attachment.
 * Signed storage links expire, so a tab holding one fails later ("exp" claim timestamp check failed)
 * when reloaded or restored. This page signs a fresh link every time it loads and shows the file in a
 * full-window frame; files a browser cannot show are redirected to a fresh download link.
 * The file itself comes straight from storage, so large files are not limited by the function size.
 */
export async function GET(_request: NextRequest, { params }: { params: { uuid: string } }) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  const attachment = await prisma.attachments.findUnique({ where: { uuid: params.uuid } }).catch(() => null);
  if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  if (attachment.storage_provider !== 'supabase') {
    return NextResponse.json({ error: 'Unsupported storage provider' }, { status: 400 });
  }

  let url: string;
  try {
    url = await getAttachmentDownloadUrl(attachment.storage_bucket || 'payment-attachments', attachment.storage_path, LINK_SECONDS);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to open the file' }, { status: 500 });
  }

  const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };
  if (!isInline(attachment.mime_type)) {
    return NextResponse.redirect(url, { status: 302, headers: noStore });
  }

  const title = escapeHtml(attachment.file_name || 'Attachment');
  const src = escapeHtml(url);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>html,body{margin:0;height:100%;background:#525659}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body><iframe src="${src}" title="${title}"></iframe></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...noStore } });
}
