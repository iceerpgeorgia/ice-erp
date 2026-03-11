import { NextRequest, NextResponse } from 'next/server';
import {
  bogApiRequest,
  getBogAccessToken,
  getBogConfigStatus,
  getTokenPreview,
} from '@/lib/integrations/bog/client';

export const dynamic = 'force-dynamic';

function sanitizePath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.includes('://')) return null;
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pingPath = sanitizePath(searchParams.get('path'));
    const insiderUuid = searchParams.get('insiderUuid') || undefined;

    const config = getBogConfigStatus();
    const token = await getBogAccessToken({ insiderUuid });
    const tokenPreview = getTokenPreview(token);

    if (!pingPath) {
      return NextResponse.json({
        ok: true,
        mode: 'token-only',
        message:
          'BOG token is available. Pass ?path=/your-readonly-endpoint to run a GET ping against Business Online API.',
        config,
        token: tokenPreview,
      });
    }

    const ping = await bogApiRequest({
      method: 'GET',
      path: pingPath,
      insiderUuid,
    });

    return NextResponse.json({
      ok: ping.ok,
      mode: 'token-and-ping',
      path: pingPath,
      status: ping.status,
      correlationId: ping.correlationId,
      config,
      token: tokenPreview,
      response: ping.data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'BOG smoke test failed',
        config: getBogConfigStatus(),
      },
      { status: 500 }
    );
  }
}
