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

function detectLanguage(text: string): 'georgian' | 'english' {
  // Georgian Unicode range: U+10A0–U+10FF
  const georgianRegex = /[\u10A0-\u10FF]/g;
  const georgianChars = (text.match(georgianRegex) || []).length;
  const totalChars = text.length;
  
  // If more than 20% of characters are Georgian, treat as Georgian
  return georgianChars / totalChars > 0.2 ? 'georgian' : 'english';
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

    // Detect language from the last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const detectedLanguage = lastUserMessage ? detectLanguage(lastUserMessage.content) : 'english';
    const languageInstruction = detectedLanguage === 'georgian'
      ? 'Respond ONLY in Georgian. გამოიყენე ქართული ენა.'
      : 'Respond ONLY in English. Use English language.';

    const groq = getGroqClient();
    if (!groq) {
      return NextResponse.json(
        { error: 'Groq API key not configured' },
        { status: 500 }
      );
    }

    // Add system context for the AI - comprehensive app knowledge
    const systemMessage: Message = {
      role: 'system',
      content: `You are an expert support AI for ice-erp, a Georgian ERP system for financial management and business operations. You have deep knowledge of all features and workflows.

SYSTEM OVERVIEW:
- Next.js 14 app with TypeScript, Prisma ORM, Supabase PostgreSQL
- Georgian-focused: handles GEL currency, Georgian tax/business rules, bank XML imports (BOG, TBC), RS.ge waybill sync
- Vercel deployment with scheduled cron jobs for bank data and exchange rate imports

KEY PAGES & FEATURES:

**Handovers Page** (/handovers):
- Shows job distributions for a project with automatic payments allocation
- Jobs Table: Lists project jobs with columns: Description, Quantity, Unit, Selling Price, Paid Nominal, Paid GEL, Debit Nominal, Debit GEL, Total GEL
- Job Distributions Grid: Bank transaction-style rows for income payments linked to each job
- Payment allocation: Tracks how bank transactions are distributed across project jobs
- XLSX Export: Flattens each payment into one row per job allocation so exported amounts reflect distribution splits
- Auto-distribution: Weighted by job selling price; Manual mode allows per-row edits

**Bank Transactions** (/dictionaries/bank-transactions):
- Queries raw bank account tables from BOG GEL, TBC, and other banks
- Three-phase processing: Counteragent ID (Phase 1, highest priority) → Parsing Rules → Payment ID matching
- Counteragent is KING: Once identified in Phase 1, cannot be overridden
- Raw tables: \`{IBAN}_{BANK}_{CURRENCY}\` pattern, only data source (consolidated table removed 2026-06-06)
- Payment ID batching: BTC_ batch IDs are resolved to partition payment IDs in UI views

**Payments & Ledger** (/dictionaries/payments):
- Tracks income and expense payments with financial codes and projects
- Waybill-derived payments: Auto-created when waybill bound to project, marked waybill_derived=true, read-only in UI
- Payment groups: One payment per unique (counteragent, project, financial_code, currency) combo
- Job allocation: payments_jobs table links distributions to bank transactions

**Waybills** (/dictionaries/waybills):
- Synced from RS.ge SOAP API (Georgian customs data)
- Fields: Counteragent, items (unit, quantity, amount), project binding, financial code, VAT status
- Scheduled sync: Every 4 hours for today's waybills, daily for last 3 months corrections
- Unit handling: 14 official RS.ge unit IDs (ID=99 is custom via UNIT_TXT field)
- Items bindings: User can assign project/financial code per item (item-level priority over waybill-level)

**Reports**:
- Payments Report: Aggregates by financial code, counteragent, project; shows paid sums, accruals, orders
- Projects Report: Project-level analysis with value scaling and financial breakdown
- Salary Accruals: Monthly salary calculations and payment tracking
- RS.ge Waybills: Import and management of Georgian customs documents

COMMON WORKFLOWS:
1. Bank Import: Upload BOG XML → Parses, identifies counteragents by INN → Applies parsing rules → Matches payment IDs
2. Waybill Processing: RS.ge sync → Binds to projects → Auto-creates payments → Users allocate items to jobs
3. Job Distribution: Select payment in Handovers → Auto-distribute by job selling price or manual allocate → Export to XLSX
4. Payment Confirmation: Mark payments as confirmed/reconciled with bank statements

TECHNICAL DETAILS:
- Authentication: NextAuth with getServerSession()
- Database: Prisma with Supabase PostgreSQL
- Real-time features: useSession() hook for auth state
- Error boundaries: Class-based React.ErrorBoundary for crash isolation
- Logging: Component-level logging with 500-entry circular buffer, error reporting to /api/logs

WHEN USER DESCRIBES A PROBLEM:
- Understand the specific page/feature involved (Handovers, Bank Transactions, etc)
- Ask for context: What are they trying to do? What's the expected vs actual behavior?
- Reference specific columns/tables if relevant (e.g., "Does the Jobs Table show data?")
- Consider Georgia-specific workflows (bank formats, customs rules, GEL currency)
- If XLSX export issue: Check if Job Distributions grid loads, if payment allocation data exists

LANGUAGE: Respond ONLY in ${detectedLanguage === 'georgian' ? 'Georgian' : 'English'}. NO MIXING.`,
    };

    // Prepare messages with system context
    const allMessages = [systemMessage, ...messages];

    console.log('[AI-CHAT] Calling Groq API with', {
      messageCount: allMessages.length,
      model,
      detectedLanguage,
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

    const assistantMessage = completion.choices[0]?.message?.content || '';

    console.log('[AI-CHAT] Groq response received:', {
      hasContent: !!assistantMessage,
      contentLength: assistantMessage.length,
      tokens: completion.usage?.total_tokens,
      choicesCount: completion.choices?.length,
      finishReason: completion.choices[0]?.finish_reason,
      fullContent: assistantMessage.substring(0, 100), // Log first 100 chars
    });

    if (!assistantMessage || assistantMessage.trim() === '') {
      console.error('[AI-CHAT] Empty content from Groq, full response:', JSON.stringify(completion, null, 2));
      return NextResponse.json(
        { error: 'AI responded with empty content' },
        { status: 500 }
      );
    }

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
