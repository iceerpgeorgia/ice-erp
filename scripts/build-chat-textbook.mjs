// Builds the AI chat's textbook from AGENTS.md: lib/ai-chat/textbook.generated.json.
// Runs before every `next build` (see package.json "build") and alone with `pnpm textbook`.
// Rules (documented in AGENTS.md > Documentation Policy):
// - every `##` section starts with <!-- chat: include; routes: ... --> or <!-- chat: exclude -->;
// - a `###` subsection of an included section may carry <!-- chat: exclude -->;
// - every page in app/ (except sign-in and error pages) has a line in the Pages section.
// Fails (exit 1) when a rule is broken, so a change cannot ship without its description.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'AGENTS.md');
const OUTPUT = join(ROOT, 'lib', 'ai-chat', 'textbook.generated.json');
const IGNORED_PAGE_PREFIXES = ['/auth/'];

const markdown = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
const errors = [];

// Environment variable names must never reach users: every key in .env.example plus anything that
// looks like a secret or connection setting.
const envNames = new Set();
try {
  for (const line of readFileSync(join(ROOT, '.env.example'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]{2,})\s*=/.exec(line);
    if (m) envNames.add(m[1]);
  }
} catch {
  // no .env.example: the generic pattern below still applies
}
const SECRET_LIKE = /\b[A-Z][A-Z0-9_]*_(?:KEY|SECRET|PASSWORD|TOKEN|SU|SP|JSON|URL|MAP|EMAIL|USER)\b/g;
// Local configuration files and deploy commands are engineering detail, not for users.
const LOCAL_DETAIL = /`?\.env(?:\.[a-z]+)?`?|`?npx vercel[^`\n]*`?/g;
const maskSecrets = (text) => {
  let out = text.replace(SECRET_LIKE, '[configuration setting]').replace(LOCAL_DETAIL, '[configuration]');
  for (const name of envNames) out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), '[configuration setting]');
  return out;
};

// Split into `##` sections.
const sections = [];
let current = null;
for (const line of markdown.split('\n')) {
  const h2 = /^## (.+)$/.exec(line);
  if (h2) {
    current = { title: h2[1].trim(), lines: [] };
    sections.push(current);
  } else if (current) {
    current.lines.push(line);
  }
}

const parseMarker = (line) => {
  const m = /^<!--\s*chat:\s*(include|exclude)\s*(?:;\s*routes:\s*([^>]*?))?\s*-->$/.exec((line ?? '').trim());
  if (!m) return null;
  return {
    include: m[1] === 'include',
    routes: m[2] ? m[2].split(',').map((r) => r.trim()).filter(Boolean) : [],
  };
};

const included = [];
for (const section of sections) {
  const firstContent = section.lines.find((line) => line.trim() !== '');
  const marker = parseMarker(firstContent);
  if (!marker) {
    errors.push(`Section "## ${section.title}" has no chat marker (<!-- chat: include; routes: ... --> or <!-- chat: exclude -->) on its first line.`);
    continue;
  }
  if (!marker.include) continue;

  // Drop excluded ### subsections, then all HTML comments.
  const kept = [];
  let skipping = false;
  for (let i = 0; i < section.lines.length; i += 1) {
    const line = section.lines[i];
    if (/^### /.test(line)) {
      const nextContent = section.lines.slice(i + 1).find((l) => l.trim() !== '');
      skipping = Boolean(parseMarker(nextContent) && !parseMarker(nextContent).include);
    }
    if (!skipping) kept.push(line);
  }
  const content = maskSecrets(kept.join('\n').replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim());
  included.push({ title: section.title, routes: marker.routes, content });
}

// Every page must be described in the Pages section.
const pagesSection = included.find((s) => s.title === 'Pages');
if (!pagesSection) errors.push('AGENTS.md has no included "## Pages" section.');

const routes = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name === 'page.tsx' || name === 'page.ts' || name === 'page.jsx' || name === 'page.js') {
      const rel = relative(join(ROOT, 'app'), dirname(full)).split(sep).join('/');
      const route = '/' + rel.split('/').filter((seg) => seg && !/^\(.*\)$/.test(seg)).join('/');
      routes.push(route === '/' ? '/' : route.replace(/\/$/, ''));
    }
  }
};
walk(join(ROOT, 'app'));

const pages = [];
if (pagesSection) {
  for (const line of pagesSection.content.split('\n')) {
    const m = /^- `([^`]+)` — (.+)$/.exec(line.trim());
    if (m) pages.push({ route: m[1], description: m[2] });
  }
  for (const route of routes) {
    if (IGNORED_PAGE_PREFIXES.some((prefix) => route.startsWith(prefix))) continue;
    if (!pagesSection.content.includes('`' + route + '`')) {
      errors.push(`Page ${route} is not described in AGENTS.md > Pages.`);
    }
  }
}

if (errors.length > 0) {
  console.error('[chat textbook] AGENTS.md is not ready for the AI chat:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

const textbook = {
  source: 'AGENTS.md',
  sourceSha256: createHash('sha256').update(markdown).digest('hex'),
  sections: included,
  pages,
};
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(textbook, null, 1) + '\n');
const chars = included.reduce((n, s) => n + s.content.length, 0);
console.log(`[chat textbook] ${included.length} sections, ${pages.length} page lines, ${chars} characters -> ${relative(ROOT, OUTPUT)}`);
