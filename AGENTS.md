# Repository Guidelines

## Project Structure & Module Organization
The workspace is a pnpm monorepo with three core apps: `apps/webapp` hosts the Next.js UI (pages and components live in `app/` with co-located hooks and styles), `apps/server` exposes the Node API (HTTP routes in `src/routes`, business logic in `src/modules`), and `apps/workers` handles queues under `src/jobs`. Shared Prisma schema and migrations sit in `prisma/`, reusable types in `types/`, and Playwright suites in `tests/e2e/` alongside auth helpers.

## Build, Test, and Development Commands
Install dependencies once with `pnpm i`. Use `pnpm dev` to launch web, API, and workers concurrently while developing. Whenever `prisma/schema.prisma` changes, run `pnpm prisma migrate dev --name <feature>` followed by `pnpm prisma generate` to refresh the client. After adding new models to the schema, run `python scripts/auto-generate-templates.py` to automatically create Excel import templates in the `templates/` folder. Execute `pnpm test` for Jest coverage and `pnpm test:e2e` when end-to-end verification is required; append `--watch` for quick feedback loops.

## Coding Style & Naming Conventions
All code is TypeScript and must satisfy the shared ESLint + Prettier rules via `pnpm lint` or `pnpm lint --fix`. Name files in kebab-case (`user-profile.ts`), React components in PascalCase (`UserProfile.tsx`), and variables or functions in camelCase. Keep comments purposeful: explain non-obvious invariants, integration quirks, or domain rules.

## Testing Guidelines
Favor tests on public contracts: API handlers, Prisma services, and UI state reducers. Co-locate Jest specs as `*.test.ts(x)` near their source or under `tests/`, and refresh fixtures in `tests/fixtures/` when behavior shifts. Capture cross-surface flows, including auth, with Playwright specs; start `pnpm dev` before launching them to ensure all services are available.

## Commit & Pull Request Guidelines
Use Conventional Commits (for example `feat(auth): add oauth screen` or `fix(orders): correct pagination`) and mention migration identifiers in commit bodies when schema changes occur. Pull requests need a concise summary, linked Jira issue, updated tests, and UI screenshots whenever the webapp shifts. Call out manual steps (migrations, env vars, or backfills) so reviewers can reproduce outcomes.

## Security & Configuration Tips
Never commit secrets; `.env.local` should hold placeholders only. Regenerate the Prisma client after each migration, and cast BigInt identifiers as `BigInt(Number(id))` in server responses to avoid JSON serialization issues. Surface any new configuration or operational follow-ups in PR descriptions to keep deploys predictable.
