import { NextRequest, NextResponse } from 'next/server';
import { deleteAttachmentLink } from '@/lib/attachments';
import { getSupabaseServer } from '@/lib/supabase';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

/**
 * DELETE /api/jobs/attachments/delete?linkUuid=xxx&storageBucket=...&storagePath=...
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  try {
    const { searchParams } = new URL(request.url);
    const linkUuid = searchParams.get('linkUuid');
    const storageBucket = searchParams.get('storageBucket');
    const storagePath = searchParams.get('storagePath');

    if (!linkUuid) {
      return NextResponse.json({ error: 'linkUuid is required' }, { status: 400 });
    }

    await deleteAttachmentLink(linkUuid);

    if (storageBucket && storagePath) {
      const supabase = getSupabaseServer();
      const { error } = await supabase.storage.from(storageBucket).remove([storagePath]);
      if (error) console.warn('Failed to delete file from storage:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting job attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete attachment' },
      { status: 500 },
    );
  }
}
