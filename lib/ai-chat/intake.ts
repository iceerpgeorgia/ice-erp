import { z } from 'zod/v4';

export const AI_CHAT_MODEL = 'claude-haiku-5-5';

export type ChatLanguage = 'georgian' | 'english';

export function detectLanguage(text: string): ChatLanguage {
  const georgianChars = (text.match(/[Ⴀ-ჿ]/g) || []).length;
  return text.length > 0 && georgianChars / text.length > 0.2 ? 'georgian' : 'english';
}

/** What the browser tells the server about where the user is. Role is never taken from here. */
export const PageContextSchema = z
  .object({
    pathname: z.string().max(500).optional(),
    search: z.string().max(2000).optional(),
    pageTitle: z.string().max(300).optional(),
    viewport: z.string().max(40).optional(),
  })
  .partial();
export type PageContext = z.infer<typeof PageContextSchema>;

const ClarifyingQuestionSchema = z.object({
  question: z.string().describe('One short question in plain language, in the user\'s language.'),
  options: z
    .array(z.string())
    .describe('0-4 short likely answers the user can click; empty when only free text makes sense.'),
});

export const RequestSchema = z.object({
  type: z.enum(['bug', 'improvement', 'upgrade']),
  title: z.string().describe('Short title, max ~12 words.'),
  page: z.string().describe('Page name as users see it in the menu, plus its route if known.'),
  current_behaviour: z.string().describe('What happens now, in the user\'s words made clear.'),
  desired_behaviour: z.string().describe('What should happen instead.'),
  steps_to_reproduce: z.array(z.string()).describe('For bugs: numbered steps. Empty for other types.'),
  examples: z.array(z.string()).describe('Concrete records, numbers, IDs, dates the user gave.'),
  acceptance_criteria: z.array(z.string()).describe('Checks that prove the request is done, each one testable.'),
  notes: z.array(z.string()).describe('Related app rules from the textbook and anything still uncertain.'),
});
export type ChangeRequest = z.infer<typeof RequestSchema>;

export const ChatTurnSchema = z.object({
  kind: z
    .enum(['question', 'answer', 'request'])
    .describe('question = you need more facts; answer = you answered a how-to question; request = the finished request.'),
  message: z.string().describe('Text shown to the user, in the user\'s language, plain words.'),
  questions: z.array(ClarifyingQuestionSchema).describe('Only for kind=question: 1-3 questions. Otherwise empty.'),
  request: RequestSchema.nullable().describe('Only for kind=request. Otherwise null.'),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const INTAKE_RULES = `You are the request assistant inside ICE ERP, a Georgian ERP web app (finance, bank statements, payments, projects, RS.ge waybills, inventories, salaries).
Users of the app tell you about problems they hit and ideas for changes. They are accountants and managers, not programmers, and they are not good at describing problems. Your job is to turn what they say into a clear, complete request that a developer (an AI coding agent) can act on without asking anything else.

HOW TO WORK
1. Classify the request:
   - bug: something in the app does not work as it should (wrong number, error, missing data, button does nothing).
   - improvement: an existing page or feature should work differently or be easier to use.
   - upgrade: something new the app cannot do today (new page, report, integration, automation).
2. Check what is missing. A request is clear only when you know, without guessing:
   - which page (and which table, column, button or dialog) it is about;
   - for a bug: what the user did step by step, what they expected, what happened instead, and at least one concrete example (a record, payment ID, waybill number, date, amount);
   - for an improvement or upgrade: what they want to achieve, who uses it, and how they will know it works.
   Use the textbook below (the app's own rules) to ask precise questions. If the textbook says the app deliberately works a certain way, say so in simple words and ask whether they want that rule changed or whether something else is wrong. If two features could be meant, ask which one, naming both as users see them.
3. While something important is missing or ambiguous, reply with kind="question": a one-sentence restatement of what you understood so far in "message", and 1-3 short questions in "questions", most important first. Offer clickable options when the likely answers are few. Never ask something the user already said or that the page context already tells you (the current page is given below). Do not ask about technical things a user cannot know (code, database, API).
4. Keep asking until the request is unambiguous. Then reply with kind="request" and fill "request". "message" then asks, in one or two sentences, whether this wording is ready to be saved and sent to the admins, or whether they want to change something. Nothing is saved until the user presses "Yes, save it".
   If the user then asks for changes, apply them (ask again only if the change itself is unclear) and reply with kind="request" again with the updated wording.
5. If the user only asks how something in the app works, answer it from the textbook with kind="answer" (do not invent features), and offer to write it up as a request if it looks like a problem.
6. If the user says to write it now / stop asking (or the system note FORCE_FINAL is present), produce kind="request" with what you have and list the unknowns in "notes".

LANGUAGE AND STYLE (very important)
- Write everything (message, questions, options and every field of the request) in the language the user writes in: Georgian if they write Georgian, English if English. Never mix.
- Plain everyday language. No programming words, table names, API routes, SQL or code in the request text. Use the names users see on screen (menu labels, column headers, button names).
- Short sentences. Questions under 20 words each.
- Keep the user's own facts exactly (numbers, IDs, names, dates). Never invent facts; mark guesses as unknown in notes.
- Acceptance criteria are concrete checks, e.g. "On Waybill Items, choosing an inventory for one row also fills it for other unbound rows with the same name and unit."`;

export function buildPageNote(args: {
  language: ChatLanguage;
  context: PageContext;
  pageTitle: string | null;
  pageSections: string[];
  role: string;
  forceFinal: boolean;
}): string {
  const { context, pageTitle, pageSections, role, language, forceFinal } = args;
  const lines = [
    'CURRENT SITUATION (from the app, not from the user):',
    `- User language: ${language === 'georgian' ? 'Georgian' : 'English'}`,
    `- Current page: ${pageTitle ?? context.pageTitle ?? 'unknown'} (${context.pathname ?? 'unknown route'})`,
    context.search ? `- Page filters / URL parameters: ${context.search}` : null,
    `- User role: ${role}`,
    pageSections.length > 0
      ? `- Textbook sections about this page: ${pageSections.join('; ')}`
      : null,
    'Assume the request is about this page and do NOT ask the user to confirm the page. Ask about the page only if their words clearly name a different one.',
    forceFinal ? 'FORCE_FINAL: the user asked to write the request now. Reply with kind="request".' : null,
  ];
  return lines.filter(Boolean).join('\n');
}

const LABELS: Record<ChatLanguage, Record<string, string>> = {
  english: {
    bug: 'Bug',
    improvement: 'Improvement',
    upgrade: 'Upgrade',
    page: 'Page',
    current: 'What happens now',
    desired: 'What should happen',
    steps: 'Steps to reproduce',
    examples: 'Examples',
    acceptance: 'Done when',
    notes: 'Notes',
    context: 'App context',
    url: 'Address',
    role: 'User role',
    reporter: 'Reported by',
    time: 'Time',
    screen: 'Screen',
    version: 'App version',
  },
  georgian: {
    bug: 'ხარვეზი',
    improvement: 'გაუმჯობესება',
    upgrade: 'ახალი შესაძლებლობა',
    page: 'გვერდი',
    current: 'რა ხდება ახლა',
    desired: 'რა უნდა ხდებოდეს',
    steps: 'როგორ გავიმეოროთ',
    examples: 'მაგალითები',
    acceptance: 'დასრულებულია, როცა',
    notes: 'შენიშვნები',
    context: 'აპის კონტექსტი',
    url: 'მისამართი',
    role: 'მომხმარებლის როლი',
    reporter: 'ავტორი',
    time: 'დრო',
    screen: 'ეკრანი',
    version: 'აპის ვერსია',
  },
};

/** Renders the finished request as Markdown in the user's language, with app facts appended. */
export function renderRequestMarkdown(
  request: ChangeRequest,
  language: ChatLanguage,
  facts: { url: string | null; role: string; reporter: string; time: string; viewport?: string; version?: string }
): string {
  const l = LABELS[language];
  const list = (items: string[], numbered = false) =>
    items.map((item, i) => `${numbered ? `${i + 1}.` : '-'} ${item}`).join('\n');
  const parts = [
    `# [${l[request.type]}] ${request.title}`,
    `**${l.page}:** ${request.page}`,
    `## ${l.current}\n${request.current_behaviour}`,
    `## ${l.desired}\n${request.desired_behaviour}`,
    request.steps_to_reproduce.length > 0 ? `## ${l.steps}\n${list(request.steps_to_reproduce, true)}` : null,
    request.examples.length > 0 ? `## ${l.examples}\n${list(request.examples)}` : null,
    request.acceptance_criteria.length > 0 ? `## ${l.acceptance}\n${list(request.acceptance_criteria)}` : null,
    request.notes.length > 0 ? `## ${l.notes}\n${list(request.notes)}` : null,
    `## ${l.context}\n${list(
      [
        facts.url ? `${l.url}: ${facts.url}` : null,
        `${l.role}: ${facts.role}`,
        `${l.reporter}: ${facts.reporter}`,
        `${l.time}: ${facts.time}`,
        facts.viewport ? `${l.screen}: ${facts.viewport}` : null,
        facts.version ? `${l.version}: ${facts.version}` : null,
      ].filter((x): x is string => Boolean(x))
    )}`,
  ];
  return parts.filter(Boolean).join('\n\n');
}

/** Plain-text version of an assistant turn, used as history for the next model call. */
export function turnToHistoryText(turn: ChatTurn, markdown: string | null): string {
  if (turn.kind === 'request' && markdown) return `${turn.message}\n\n${markdown}`;
  if (turn.kind === 'question' && turn.questions.length > 0) {
    return `${turn.message}\n${turn.questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}`;
  }
  return turn.message;
}

/** App facts appended to a finished request. Identity and role always come from the server session. */
export function requestFacts(
  user: { name?: string | null; email: string; role?: string | null },
  context: PageContext
) {
  return {
    url: context.pathname ? `${context.pathname}${context.search ?? ''}` : null,
    role: user.role || 'user',
    reporter: user.name ? `${user.name} <${user.email}>` : user.email,
    time: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi' }),
    viewport: context.viewport,
    version: process.env.VERCEL_URL ?? 'local',
  };
}
