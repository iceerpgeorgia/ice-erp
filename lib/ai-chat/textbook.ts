// The AI chat's textbook: user-safe sections of AGENTS.md, generated on every build by
// scripts/build-chat-textbook.mjs into textbook.generated.json. Never edit the JSON by hand;
// change AGENTS.md (see its Documentation Policy) and the next build picks it up.
import textbook from './textbook.generated.json';

type TextbookSection = { title: string; routes: string[]; content: string };
type TextbookPage = { route: string; description: string };

const sections = textbook.sections as TextbookSection[];
const pages = textbook.pages as TextbookPage[];

// "/payment-statement/[paymentId]" matches "/payment-statement/abc"; a section route also covers its sub-pages.
const routePattern = (route: string, exact: boolean) =>
  new RegExp(
    '^' +
      route
        .replace(/[.*+?^${}()|\\]/g, '\\$&')
        .replace(/\\\[[^\]]+\\\]|\[[^\]]+\]/g, '[^/]+') +
      (exact ? '/?$' : '(?:/.*)?$')
  );

const STABLE = [
  'ICE ERP app textbook (generated from the project documentation; this is how the app works today).',
  ...sections.map((section) => `## ${section.title}\n${section.content}`),
].join('\n\n');

export type ChatTextbook = {
  // All user-safe sections; put it in the prompt-cached system part.
  stable: string;
  // Titles of the sections about the page the user is on.
  pageSections: string[];
  // The page's line from Pages ("Waybill Items: the goods lines …"), or null for an unknown page.
  pageTitle: string | null;
};

export function getChatTextbook(pathname?: string | null): ChatTextbook {
  const path = (pathname || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const page = pathname
    ? pages
        .filter((p) => routePattern(p.route, true).test(path))
        // the most specific route wins ("/handovers/print" over "/handovers")
        .sort((a, b) => b.route.length - a.route.length)[0]
    : undefined;
  const pageSections = pathname
    ? sections
        .filter((s) => s.title !== 'Pages' && s.routes.some((r) => r !== '*' && routePattern(r, false).test(path)))
        .map((s) => s.title)
    : [];
  return { stable: STABLE, pageSections, pageTitle: page ? page.description : null };
}
