import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../route';

// Long filter lists overflow the URL length limit (HTTP 431), so the same read is accepted as a JSON body.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid query body' }, { status: 400 });
  }
  const url = new URL(req.url);
  url.search = '';
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return GET(new NextRequest(url, { headers: req.headers }));
}
