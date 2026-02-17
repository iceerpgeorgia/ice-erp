import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fileName = String(body?.fileName || '').trim();
    const bucket = String(body?.bucket || 'bank-xml-uploads').trim();

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const fileSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const filePath = `bank-xml/${fileSuffix}-${fileName}`;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(filePath);

    if (error || !data?.signedUrl || !data?.token) {
      return NextResponse.json(
        { error: error?.message || 'Failed to create signed upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path || filePath,
      bucket,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create upload URL' },
      { status: 500 }
    );
  }
}