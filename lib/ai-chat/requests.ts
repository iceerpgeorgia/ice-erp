import { prisma, withRetry } from '@/lib/prisma';
import { sendEmail } from '@/lib/payment-notifications';

// Finished requests from the in-app AI chat (table ai_change_requests). The chat saves one when the
// user submits the final plain-language prompt; admins (role admin or system_admin) get an email and
// manage them on /admin/ai-requests. Raw SQL so the module does not depend on a regenerated client.
export const REQUEST_TYPES = ['bug', 'improvement', 'upgrade'] as const;
export const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'rejected'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_ADMIN_ROLES = ['admin', 'system_admin'];

export type ChangeRequestInput = {
  type: RequestType;
  language: 'ka' | 'en';
  title: string;
  prompt: string;
  pathname: string | null;
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export type ChangeRequest = ChangeRequestInput & {
  id: number;
  requesterEmail: string | null;
  requesterName: string | null;
  status: RequestStatus;
  adminNote: string | null;
  emailedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const MAX_PROMPT = 20000;
const MAX_CONVERSATION = 100;

/** Validates the chat's POST body. Returns the clean input or an error message. */
export function parseChangeRequestInput(body: any): { input?: ChangeRequestInput; error?: string } {
  // The chat must show the final wording and get the user's explicit "yes, it's ready" before saving.
  if (body?.confirmed !== true) return { error: 'The user has not confirmed the final wording (confirmed: true is required)' };
  const type = String(body?.type ?? '');
  if (!REQUEST_TYPES.includes(type as RequestType)) return { error: 'type must be bug, improvement or upgrade' };
  const language = body?.language === 'ka' ? 'ka' : 'en';
  const title = String(body?.title ?? '').trim().slice(0, 200);
  const prompt = String(body?.prompt ?? '').trim();
  if (!title) return { error: 'title is required' };
  if (!prompt) return { error: 'prompt is required' };
  if (prompt.length > MAX_PROMPT) return { error: `prompt is longer than ${MAX_PROMPT} characters` };
  const pathname = typeof body?.pathname === 'string' && body.pathname.startsWith('/') ? body.pathname.slice(0, 500) : null;
  const conversation = (Array.isArray(body?.conversation) ? body.conversation : [])
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .slice(-MAX_CONVERSATION)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_PROMPT) }));
  return { input: { type: type as RequestType, language, title, prompt, pathname, conversation } };
}

const toRequest = (row: any): ChangeRequest => ({
  id: Number(row.id),
  type: row.type,
  language: row.language,
  title: row.title,
  prompt: row.prompt,
  pathname: row.pathname,
  conversation: Array.isArray(row.conversation) ? row.conversation : [],
  requesterEmail: row.requester_email,
  requesterName: row.requester_name,
  status: row.status,
  adminNote: row.admin_note,
  emailedAt: row.emailed_at ? new Date(row.emailed_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TYPE_LABEL: Record<RequestType, string> = { bug: 'Bug', improvement: 'Improvement', upgrade: 'Upgrade' };

async function emailAdmins(request: ChangeRequest): Promise<boolean> {
  const admins = await prisma.user.findMany({
    where: { role: { in: REQUEST_ADMIN_ROLES }, isAuthorized: true, email: { not: null } },
    select: { email: true },
  });
  const recipients = [...new Set(admins.map((admin) => admin.email!).filter(Boolean))];
  if (recipients.length === 0) return false;

  const appUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  const link = `${appUrl}/admin/ai-requests?id=${request.id}`;
  const who = request.requesterName || request.requesterEmail || 'A user';
  const subject = `ICE ERP ${TYPE_LABEL[request.type].toLowerCase()} #${request.id}: ${request.title}`;
  const text = [
    `${who} sent a ${TYPE_LABEL[request.type].toLowerCase()} from the AI chat${request.pathname ? ` on ${request.pathname}` : ''}.`,
    '',
    request.prompt,
    '',
    `Open it: ${link}`,
  ].join('\n');
  const html =
    `<p>${escapeHtml(who)} sent a <b>${TYPE_LABEL[request.type].toLowerCase()}</b> from the AI chat` +
    `${request.pathname ? ` on <code>${escapeHtml(request.pathname)}</code>` : ''}.</p>` +
    `<div style="white-space:pre-wrap;border-left:3px solid #ccc;padding-left:12px">${escapeHtml(request.prompt)}</div>` +
    `<p><a href="${escapeHtml(link)}">Open request #${request.id}</a></p>`;
  await sendEmail({ to: recipients.join(', '), subject, text, html, fromName: 'ICE ERP Requests' });
  return true;
}

/** Saves a finished request, then emails the admins. An email failure never loses the request. */
export async function createChangeRequest(
  requester: { id?: string | null; email?: string | null; name?: string | null },
  input: ChangeRequestInput
): Promise<{ request: ChangeRequest; emailed: boolean }> {
  const [row] = await withRetry(() =>
    prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO ai_change_requests
         (requester_id, requester_email, requester_name, pathname, type, language, title, prompt, conversation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      requester.id ?? null,
      requester.email ?? null,
      requester.name ?? null,
      input.pathname,
      input.type,
      input.language,
      input.title,
      input.prompt,
      JSON.stringify(input.conversation)
    )
  );
  const request = toRequest(row);
  let emailed = false;
  try {
    emailed = await emailAdmins(request);
    if (emailed) {
      await withRetry(() => prisma.$executeRawUnsafe(`UPDATE ai_change_requests SET emailed_at = now() WHERE id = $1`, request.id));
    }
  } catch (error) {
    console.error('[ai-change-requests] admin email failed', { id: request.id, error });
  }
  return { request: { ...request, emailedAt: emailed ? new Date().toISOString() : null }, emailed };
}

export async function listChangeRequests(status?: string | null): Promise<ChangeRequest[]> {
  const rows = await withRetry(() =>
    status && REQUEST_STATUSES.includes(status as RequestStatus)
      ? prisma.$queryRawUnsafe<any[]>(`SELECT * FROM ai_change_requests WHERE status = $1 ORDER BY created_at DESC LIMIT 500`, status)
      : prisma.$queryRawUnsafe<any[]>(`SELECT * FROM ai_change_requests ORDER BY created_at DESC LIMIT 500`)
  );
  return rows.map(toRequest);
}

export async function updateChangeRequest(
  id: number,
  changes: { status?: string; adminNote?: string | null }
): Promise<ChangeRequest | null> {
  if (changes.status !== undefined && !REQUEST_STATUSES.includes(changes.status as RequestStatus)) {
    throw new Error('status must be new, in_progress, done or rejected');
  }
  const [row] = await withRetry(() =>
    prisma.$queryRawUnsafe<any[]>(
      `UPDATE ai_change_requests
          SET status = COALESCE($2, status),
              admin_note = CASE WHEN $3::boolean THEN $4 ELSE admin_note END,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      id,
      changes.status ?? null,
      changes.adminNote !== undefined,
      changes.adminNote ?? null
    )
  );
  return row ? toRequest(row) : null;
}
