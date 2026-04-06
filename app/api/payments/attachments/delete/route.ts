import { NextRequest, NextResponse } from 'next/server';
import { deletePaymentAttachment } from '@/lib/attachments';
import { getSupabaseServer } from '@/lib/supabase';

/**
 * DELETE /api/payments/attachments/delete?linkUuid=xxx
 * Delete an attachment link (and clean up storage)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const linkUuid = searchParams.get('linkUuid');
    const storageBucket = searchParams.get('storageBucket');
    const storagePath = searchParams.get('storagePath');

    if (!linkUuid) {
      return NextResponse.json(
        { error: 'linkUuid is required' },
        { status: 400 }
      );
    }

    // Delete from database
    await deletePaymentAttachment(linkUuid);

    // Clean up from storage if provided
    if (storageBucket && storagePath) {
      const supabase = getSupabaseServer();
      const { error } = await supabase.storage
        .from(storageBucket)
        .remove([storagePath]);

      if (error) {
        console.warn('Failed to delete file from storage:', error);
        // Don't fail the request if storage cleanup fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
