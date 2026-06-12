import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth, isAuthError } from '@/lib/auth-guard';

function getGroqClient(): OpenAI | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  model?: string;
}

export async function POST(req: NextRequest) {
  // Require authentication
  const auth = await requireAuth();
  if (isAuthError(auth)) return auth;

  try {
    const body = (await req.json()) as ChatRequest;
    const { messages, model = 'llama-3.1-8b-instant' } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const groq = getGroqClient();
    if (!groq) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      );
    }

    // Add system context for the AI
    const systemMessage: Message = {
      role: 'system',
      content: `You are a helpful AI assistant for an ERP system. You help users with:
- Understanding financial data and transactions
- Analyzing bank statements and payments
- Managing projects and handovers
- Answering questions about waybills and inventory
- Providing business insights and recommendations

Be concise, professional, and helpful. Use the user's language (often Georgian or English).`,
    };

    // Prepare messages with system context
    const allMessages = [systemMessage, ...messages];

    console.log('[AI-CHAT] Calling Groq API with', {
      messageCount: allMessages.length,
      model,
      hasApiKey: !!process.env.GROQ_API_KEY,
    });

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model,
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    console.log('[AI-CHAT] Groq response received:', {
      hasContent: !!completion.choices[0]?.message?.content,
      tokens: completion.usage?.total_tokens,
    });

    const assistantMessage = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      role: 'assistant',
      content: assistantMessage,
      model,
      usage: {
        prompt_tokens: completion.usage?.prompt_tokens,
        completion_tokens: completion.usage?.completion_tokens,
        total_tokens: completion.usage?.total_tokens,
      },
    });
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error('[AI-CHAT] Error Details:', {
      message: errorDetails,
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Groq API authentication failed' },
          { status: 401 }
        );
      }

      if (error.message.includes('429') || error.message.includes('rate')) {
        return NextResponse.json(
          { error: 'Rate limited. Please try again later.' },
          { status: 429 }
        );
      }

      // Return more details in dev/debug mode
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json(
          { error: `Failed to process chat message: ${errorDetails}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
