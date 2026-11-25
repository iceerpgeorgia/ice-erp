import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import {
  REQUEST_ADMIN_ROLES,
  createChangeRequest,
  listChangeRequests,
  parseChangeRequestInput,
} from '@/lib/ai-chat/requests';

export const dynamic = 'force-dynamic';

// POST: the AI chat saves a finished request (any signed-in user); admins are emailed.
// Body: { type, language, title, prompt, pathname, conversation }. 201 { id, emailed }.
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  const body = await req.json().catch(() => null);
  const { input, error } = parseChangeRequestInput(body);
  if (!input) return NextResponse.json({ error }, { status: 400 });
  try {
    const user = auth.user as { id?: string; email?: string | null; name?: string | null };
    const { request, emailed } = await createChangeRequest({ id: user.id, email: user.email, name: user.name }, input);
    return NextResponse.json({ id: request.id, emailed }, { status: 201 });
  } catch (err: any) {
    console.error('[ai-chat/requests] POST error', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

// GET ?status=new: admins (admin, system_admin) list requests, newest first.
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  if (!REQUEST_ADMIN_ROLES.includes(String((auth.user as any).role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const data = await listChangeRequests(new URL(req.url).searchParams.get('status'));
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[ai-chat/requests] GET error', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
