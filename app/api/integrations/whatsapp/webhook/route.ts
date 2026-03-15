import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OpenClawResult = {
  ok?: boolean;
  intent?: string;
  message?: string;
  error?: string;
  code?: string;
  resultCount?: number;
  results?: Array<Record<string, unknown>>;
  created?: Record<string, unknown>;
};

function timingSafeEqualText(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret?: string): boolean {
  if (!appSecret) return true;
  if (!signatureHeader) return false;

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return timingSafeEqualText(expected, signatureHeader);
}

function parseWebhookVerification(request: NextRequest): NextResponse {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const configured = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode !== 'subscribe' || !challenge || !configured) {
    return NextResponse.json({ ok: false, error: 'Verification failed' }, { status: 400 });
  }

  if (token !== configured) {
    return NextResponse.json({ ok: false, error: 'Invalid verify token' }, { status: 403 });
  }

  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

function extractMessageText(message: any): string | null {
  if (message?.type === 'text' && typeof message?.text?.body === 'string') {
    return message.text.body.trim();
  }

  if (message?.type === 'button' && typeof message?.button?.text === 'string') {
    return message.button.text.trim();
  }

  const interactive = message?.interactive;
  if (interactive?.type === 'button_reply' && typeof interactive?.button_reply?.title === 'string') {
    return interactive.button_reply.title.trim();
  }

  return null;
}

function parseConfirmationPrefix(text: string): { transcript: string; confirmWrite: boolean } {
  const trimmed = text.trim();
  const match = trimmed.match(/^(confirm|დაადასტურე)\s*[:\-]?\s*/iu);

  if (!match) {
    return { transcript: trimmed, confirmWrite: false };
  }

  return {
    transcript: trimmed.slice(match[0].length).trim(),
    confirmWrite: true,
  };
}

async function callOpenClawCommand(origin: string, transcript: string, confirmWrite: boolean): Promise<OpenClawResult> {
  const appBaseUrl = process.env.WHATSAPP_APP_BASE_URL?.trim() || origin;
  const sharedSecret = process.env.OPENCLAW_WEBHOOK_SECRET;

  if (!sharedSecret) {
    return {
      ok: false,
      code: 'CONFIG_MISSING',
      error: 'OPENCLAW_WEBHOOK_SECRET is required for WhatsApp integration.',
    };
  }

  const response = await fetch(`${appBaseUrl}/api/integrations/openclaw/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-openclaw-secret': sharedSecret,
    },
    body: JSON.stringify({ transcript, confirmWrite }),
    cache: 'no-store',
  });

  let body: OpenClawResult = {};
  try {
    body = (await response.json()) as OpenClawResult;
  } catch {
    body = { ok: false, error: 'Failed to parse command response.' };
  }

  if (!response.ok && !body.ok) {
    return {
      ...body,
      ok: false,
      error: body.error || body.message || `OpenClaw request failed (${response.status}).`,
    };
  }

  return body;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function formatOpenClawReply(result: OpenClawResult, originalTranscript: string): string {
  if (!result.ok) {
    if (result.code === 'WRITE_CONFIRMATION_REQUIRED') {
      return `For write actions, send confirmation like:\nconfirm ${originalTranscript}`;
    }

    return `Could not complete command. ${result.message || result.error || 'Unknown error.'}`;
  }

  if (result.intent === 'create_counteragent' && result.created) {
    const name = asText(result.created.displayName) || 'counteragent';
    const internalNumber = asText(result.created.internalNumber);
    return internalNumber
      ? `Created ${name}. Internal number: ${internalNumber}.`
      : `Created ${name}.`;
  }

  if (result.intent === 'get_payments' && Array.isArray(result.results)) {
    if (!result.results.length) return result.message || 'No payments found.';

    const lines = result.results.slice(0, 5).map((row) => {
      const paymentId = asText(row.paymentId);
      const counteragentName = asText(row.counteragentName);
      return `- ${paymentId || 'unknown payment'} | ${counteragentName || 'unknown counteragent'}`;
    });

    return [`${result.message || `Found ${result.results.length} payment record(s).`}`, ...lines].join('\n');
  }

  if (result.intent === 'get_counteragents' && Array.isArray(result.results)) {
    if (!result.results.length) return result.message || 'No counteragents found.';

    const lines = result.results.slice(0, 5).map((row) => {
      const displayName = asText(row.displayName);
      const internalNumber = asText(row.internalNumber);
      return internalNumber ? `- ${displayName} (${internalNumber})` : `- ${displayName}`;
    });

    return [`${result.message || `Found ${result.results.length} counteragent record(s).`}`, ...lines].join('\n');
  }

  return result.message || 'Command executed.';
}

async function sendWhatsAppTextMessage(to: string, text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be configured.');
  }

  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text.slice(0, 4000) },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${details.slice(0, 500)}`);
  }
}

export async function GET(request: NextRequest) {
  return parseWebhookVerification(request);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifyMetaSignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET)) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as any;
    const entries = Array.isArray(body?.entry) ? body.entry : [];

    let processedMessages = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change?.field !== 'messages') continue;

        const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
        for (const message of messages) {
          const from = asText(message?.from);
          const text = extractMessageText(message);
          if (!from || !text) continue;

          const { transcript, confirmWrite } = parseConfirmationPrefix(text);
          const commandResult = await callOpenClawCommand(request.nextUrl.origin, transcript, confirmWrite);
          const reply = formatOpenClawReply(commandResult, transcript);

          await sendWhatsAppTextMessage(from, reply);
          processedMessages += 1;
        }
      }
    }

    return NextResponse.json({ ok: true, processedMessages });
  } catch (error: any) {
    console.error('[whatsapp/webhook] error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Unexpected webhook error',
      },
      { status: 500 }
    );
  }
}
