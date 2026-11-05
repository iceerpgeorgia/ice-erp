import { NextRequest, NextResponse } from 'next/server';
import {
  getTbcBisAccessToken,
  getTbcBisConfigStatus,
  getTokenPreview,
  tbcBisApiRequest,
} from '@/lib/integrations/tbc-bis/client';

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

    const config = getTbcBisConfigStatus();
    const token = await getTbcBisAccessToken({ insiderUuid });
    const tokenPreview = getTokenPreview(token);

    if (!pingPath) {
      return NextResponse.json({
        ok: true,
        mode: 'token-only',
        message:
          'TBC BIS token is available. Pass ?path=/your-readonly-endpoint to run a GET ping against BIS API.',
        config,
        token: tokenPreview,
      });
    }

    const ping = await tbcBisApiRequest({
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
        error: error?.message || 'TBC BIS smoke test failed',
        config: getTbcBisConfigStatus(),
      },
      { status: 500 }
    );
  }
}

