import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import { REQUEST_ADMIN_ROLES, updateChangeRequest } from '@/lib/ai-chat/requests';

export const dynamic = 'force-dynamic';

// PATCH { status?, adminNote? }: admins (admin, system_admin) move a request through
// new -> in_progress -> done / rejected and leave a note.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;
  if (!REQUEST_ADMIN_ROLES.includes(String((auth.user as any).role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  try {
    const updated = await updateChangeRequest(id, {
      status: typeof body?.status === 'string' ? body.status : undefined,
      adminNote: body?.adminNote === undefined ? undefined : body.adminNote === null ? null : String(body.adminNote).slice(0, 4000),
    });
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    const status = /status must be/.test(err?.message ?? '') ? 400 : 500;
    return NextResponse.json({ error: err?.message || 'Server error' }, { status });
  }
}
