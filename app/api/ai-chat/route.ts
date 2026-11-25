import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { requireAuth, isAuthError } from '@/lib/auth-guard';
import {
  AI_CHAT_MODEL,
  ChatTurnSchema,
  INTAKE_RULES,
  PageContextSchema,
  buildPageNote,
  detectLanguage,
  renderRequestMarkdown,
  requestFacts,
  turnToHistoryText,
  type PageContext,
} from '@/lib/ai-chat/intake';
import { getChatTextbook } from '@/lib/ai-chat/intake-textbook';

// Request-intake chat: asks clarifying questions grounded in the app textbook until the user's
// request is clear, then returns a structured request rendered in the user's language.

interface IncomingMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequestBody {
  messages: IncomingMessage[];
  context?: unknown;
  forceFinal?: boolean;
}

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request' }, { status: 400 });
  }

  const history = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .slice(-MAX_MESSAGES)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    : [];
  // The API requires the conversation to start with a user turn.
  while (history.length > 0 && history[0].role !== 'user') history.shift();
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'A user message is required' }, { status: 400 });
  }

  const parsedContext = PageContextSchema.safeParse(body.context ?? {});
  const context: PageContext = parsedContext.success ? parsedContext.data : {};

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
  const client = new Anthropic({ apiKey: key });

  const userText = history.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const language = detectLanguage(history[history.length - 1].content) === 'georgian' || detectLanguage(userText) === 'georgian'
    ? 'georgian'
    : 'english';
  const role = auth.user.role || 'user';
  const textbook = getChatTextbook(context.pathname);

  try {
    const response = await client.messages.parse({
      model: AI_CHAT_MODEL,
      max_tokens: 4000,
      system: [
        // Stable per deploy, so it is cached across users and turns.
        {
          type: 'text',
          text: `${INTAKE_RULES}\n\nTEXTBOOK (the app's own rules and pages; trust it over guesses):\n${textbook.stable}`,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: buildPageNote({
            language,
            context,
            pageTitle: textbook.pageTitle,
            pageSections: textbook.pageSections,
            role,
            forceFinal: body.forceFinal === true,
          }),
        },
      ],
      output_config: { effort: 'low', format: zodOutputFormat(ChatTurnSchema) },
      messages: history,
    });

    const turn = response.stop_reason === 'refusal' ? null : response.parsed_output ?? null;
    if (!turn) {
      console.error('[AI-CHAT] No structured output', { stopReason: response.stop_reason });
      return NextResponse.json({ error: 'AI did not return an answer. Please rephrase and try again.' }, { status: 502 });
    }

    const markdown =
      turn.kind === 'request' && turn.request
        ? renderRequestMarkdown(turn.request, language, requestFacts(auth.user, context))
        : null;

    console.log('[AI-CHAT] turn', {
      kind: turn.kind,
      language,
      route: context.pathname,
      inputTokens: response.usage?.input_tokens,
      cacheRead: response.usage?.cache_read_input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    return NextResponse.json({
      role: 'assistant',
      kind: turn.kind,
      content: turnToHistoryText(turn, markdown),
      message: turn.message,
      questions: turn.kind === 'question' ? turn.questions : [],
      request: turn.kind === 'request' ? turn.request : null,
      requestMarkdown: markdown,
      language,
      model: AI_CHAT_MODEL,
    });
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : undefined;
    console.error('[AI-CHAT] Error', { status, message: error instanceof Error ? error.message : String(error) });
    if (status === 429) return NextResponse.json({ error: 'Rate limited. Please try again later.' }, { status: 429 });
    if (status === 401) return NextResponse.json({ error: 'Anthropic API authentication failed' }, { status: 502 });
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV !== 'production' && error instanceof Error
            ? `Failed to process chat message: ${error.message}`
            : 'Failed to process chat message',
      },
      { status: 500 }
    );
  }
}
