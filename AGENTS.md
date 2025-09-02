# Repository Guidelines

## Project
ICE ERP – monorepo (webapp, server, workers)

## Stack
- Node.js 20
- PNPM
- Next.js / React
- Prisma + PostgreSQL
- Docker

## Rules
- Don’t commit secrets. Use `.env.local` with placeholders.
- Keep changes atomic; one logical change per commit.
- Maintain existing lint/format rules (ESLint + Prettier). Run `pnpm lint` locally.
- Update docs/tests when behavior changes.
- Keep Dockerfile changes minimal; verify with `docker compose up --build`.

## Git
- Branch from `main`.
- Branch naming examples: `feat/auth-google`, `fix/orders-pagination`, `chore(deps)-eslint-upgrade`.
- Conventional commits: `feat|fix|docs|refactor|chore(scope): message`.
- Open PR with summary, linked issues, and a test plan.

## Tests/Dev
- Install deps: `pnpm i`
- Generate Prisma client: `pnpm prisma generate`
- Run dev server: `pnpm dev`
- Run unit tests: `pnpm test`
- Run e2e tests: `pnpm test:e2e`

### Test Conventions
- Unit tests: Jest.
- E2E / integration: Playwright (use for route/auth flow changes).
- Ensure all new features include or update relevant tests.

Install test toolchain (once):
```sh
pnpm add -D jest @types/jest @testing-library/react @testing-library/jest-dom @playwright/test
pnpm exec playwright install
```

## Prisma Workflow
```sh
pnpm prisma migrate dev --name <short-feature>
pnpm prisma generate
```
