# Post-Hardening Audit (Apr 30, 2026)

Scope: re-audit after commit `2e89c6b` (auth guards on 16 routes, Zod schemas, error/loading boundaries, `@updatedAt`, hardened middleware, 21 unit tests).

Overall grade: **B-**. Foundational hardening landed, but the codebase still has meaningful gaps in API-handler-level auth, input validation, raw SQL safety, and N+1 query hygiene.

---

## P0 — Fix this sprint

### 1. SQL injection surface (`$queryRawUnsafe` × 143 occurrences)
- 143 `$queryRawUnsafe` call sites across `app/api/`. Most use `$1, $2…` placeholders correctly, but several interpolate dynamic identifiers/values via template strings:
  - [app/api/conversions/route.ts](app/api/conversions/route.ts#L40) — `IN (${insiderUuidListSql})`
  - [app/api/counteragent-statement/route.ts](app/api/counteragent-statement/route.ts#L52) — interpolated `raw_table_name`
  - [app/api/bank-transactions/route.ts](app/api/bank-transactions/route.ts) — multi-table UNION with interpolated table names
  - [app/api/bank-transactions/[id]/route.ts](app/api/bank-transactions/[id]/route.ts)
  - [app/api/bank-transactions-test/route.ts](app/api/bank-transactions-test/route.ts)
  - [app/api/payments/route.ts](app/api/payments/route.ts) — dynamic WHERE building
- Action: introduce a shared `lib/sql/safe-identifier.ts` that whitelists table names against `bank_accounts.raw_table_name` and quotes identifiers; switch interpolated values to placeholders.

### 2. API-handler auth coverage (61 mutation route files still without `requireAuth`)
Middleware already gates `/api/((?!auth|cron|test-env).*)` so most are not publicly callable, but defense-in-depth is missing in handlers — and the middleware exclusion is broad (e.g. `/api/integrations/*`, `/api/blob/upload`, `/api/storage/upload-url`).

**Highest-risk gaps (publicly reachable / data-modifying):**
- [app/api/payments/route.ts](app/api/payments/route.ts) — POST, PATCH
- [app/api/payments-ledger/route.ts](app/api/payments-ledger/route.ts), `confirm`, `deconfirm`, `bulk`
- [app/api/adjustments/route.ts](app/api/adjustments/route.ts)
- [app/api/salary-accruals/route.ts](app/api/salary-accruals/route.ts) + 3 upload routes
- [app/api/bank-transactions/upload/route.ts](app/api/bank-transactions/upload/route.ts), `import-xlsx`, `reparse`, `bulk-bind`, `parsing-lock`
- [app/api/bank-transaction-batches/route.ts](app/api/bank-transaction-batches/route.ts)
- [app/api/parsing-scheme-rules/route.ts](app/api/parsing-scheme-rules/route.ts) (+ `[id]`, `batch-run`, `test-rule`, `toggle-active`)
- [app/api/payment-redistribution/apply/route.ts](app/api/payment-redistribution/apply/route.ts), `fifo/apply`, `optimize`
- [app/api/payments/attachments/{upload,confirm,update,delete}/route.ts](app/api/payments/attachments/upload/route.ts)
- [app/api/projects/[id]/route.ts](app/api/projects/[id]/route.ts), `projects/import`
- [app/api/job-projects/route.ts](app/api/job-projects/route.ts)
- [app/api/users/route.ts](app/api/users/route.ts) — **needs `requireAdmin`**
- [app/api/clear-sessions/route.ts](app/api/clear-sessions/route.ts) — **needs `requireAdmin`**
- [app/api/banks/[uuid]/route.ts](app/api/banks/[uuid]/route.ts), `bank-accounts/[uuid]`
- [app/api/insider-selection/route.ts](app/api/insider-selection/route.ts)
- [app/api/blob/upload/route.ts](app/api/blob/upload/route.ts), `storage/upload-url`
- [app/api/exchange-rates/sync-sheets/route.ts](app/api/exchange-rates/sync-sheets/route.ts), `update`
- [app/api/waybills/bulk/route.ts](app/api/waybills/bulk/route.ts), `waybills/import`
- [app/api/admin/backparse/route.ts](app/api/admin/backparse/route.ts) — **needs `requireAdmin`**

**Intentionally public (verify, then explicitly document):**
- `/api/integrations/whatsapp/webhook` — should validate webhook signature
- `/api/integrations/tbc-id/{authorize-url,token,userinfo}` — OAuth flow endpoints
- `/api/integrations/openclaw/command`, `/api/integrations/signify/send` — verify HMAC/shared secret

### 3. No rate limiting anywhere
Zero implementation. Add `@upstash/ratelimit` + Vercel KV (or Upstash Redis) and apply at minimum to:
- `/api/auth/*` (brute-force)
- `/api/integrations/*/webhook` and TBC OAuth callbacks
- All upload endpoints (`/api/blob/upload`, `/api/bank-transactions/upload`, `/api/salary-accruals/upload-*`, `/api/waybills/import`)

---

## P1 — Next sprint

### 4. Zod validation gap (~80 mutation routes still parse raw JSON)
Only `brands`, `banks`, `entries`, plus partial usage in `currencies`/`countries`/`entity-types` routes. Add schemas to [lib/api-schemas.ts](lib/api-schemas.ts) for: `payments`, `payments-ledger`, `adjustments`, `counteragents`, `jobs`, `projects`, `waybills`, `waybill-items`, `salary-accruals`, `parsing-scheme-rules`, `payment-bundles`, `payment-redistribution`, `bank-transaction-batches`. Replace `await req.json().catch(() => ({}))` patterns — they silently swallow malformed JSON.

### 5. N+1 query patterns
- [app/api/attachments/route.ts](app/api/attachments/route.ts#L123-L191) — 6 sequential `findMany` calls per request to enrich one list (projects, payments, jobs, counteragents, users, financial_codes). Batch into a single CTE or parallel `Promise.all`.
- [app/api/waybills/route.ts](app/api/waybills/route.ts) — counteragents fetched 4× per request.
- [app/api/salary-accruals/upload-tbc-insurance/route.ts](app/api/salary-accruals/upload-tbc-insurance/route.ts) — per-employee lookups in upload loop.

### 6. Pagination missing on list endpoints
20+ `findMany()` without `take`/`skip`. Add cursor or offset pagination + sane default `take: 50` to:
- [app/api/users/route.ts](app/api/users/route.ts)
- [app/api/banks/route.ts](app/api/banks/route.ts), `dimensions`, `inventories`, `inventory-groups`, `modules`, `module-features`, `waybill-items`
- [app/api/attachments-simple/route.ts](app/api/attachments-simple/route.ts)

### 7. God files (refactor opportunity)
- [app/api/bank-transactions/route.ts](app/api/bank-transactions/route.ts) — ~1000 LOC, embedded UNION builder
- [app/api/bank-transactions-test/route.ts](app/api/bank-transactions-test/route.ts) — ~900 LOC, near-duplicate of above
- [app/api/waybills/route.ts](app/api/waybills/route.ts) — ~650 LOC
- [app/api/salary-accruals/upload-self-ge/route.ts](app/api/salary-accruals/upload-self-ge/route.ts) — ~600 LOC
- Extract: `lib/bank-transactions/union-query.ts`, `lib/salary-accruals/upload-utils.ts`. Delete `bank-transactions-test` if it's not actively used.

### 8. Missing indexes
With 62 migrations and a wide schema, scan for FKs without `@@index`. Quick spot-check candidates: `payments_ledger.payment_uuid`, `bank_transaction_batches.raw_record_uuid`, `transactions.payment_id`. Run `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` and inspect.

---

## P2 — Backlog

### 9. Logging and observability
- ~60 `console.log` calls in route handlers. Add `lib/logger.ts` (pino with `LOG_LEVEL` env) and replace.
- Cron handlers in `vercel.json` lack alerting on failure — wire to Sentry or a `/api/cron/health` heartbeat.

### 10. `next.config.js` is minimal
Add: `swcMinify: true`, `compress: true`, `images.formats: ['image/avif','image/webp']`, `modularizeImports` for `lodash`/`date-fns`/`@mui/icons-material` if used. Run `pnpm build && du -sh .next/server/app/api/*/route.js | sort -h | tail -10` to find oversized lambdas.

### 11. TypeScript hygiene
- 20+ `any` types in `app/api/`. Replace with generated types or Prisma payload types.
- Several routes still use raw bigint arithmetic without `Number()`/`String()` coercion at the JSON boundary.

### 12. Test coverage
21 tests cover only Zod schemas + auth-guard type narrowing. Critical paths with **zero** tests:
- Payment redistribution / FIFO logic
- Parsing scheme rule matching
- BTC batch resolution (per AGENTS.md, this has DB triggers + UI rules)
- Bank XML import three-phase pipeline (Python script is covered, but TS upload route is not)
- Auth flow (sign-in, session, role checks)

### 13. Migration sprawl
62 migration directories. Not a bug, but consider squashing pre-launch migrations into a single baseline if the prod DB is already past them all.

### 14. CORS / public endpoints
No `Access-Control-Allow-Origin` headers anywhere. Audit `/api/public/payment-attachments` and webhooks; explicitly set headers + `OPTIONS` handlers if cross-origin access is required.

---

## Verification metrics
- Mutation route files lacking `requireAuth`/`requireAdmin`: **61** (of ~120 mutation route files)
- `$queryRawUnsafe` call sites: **143**
- Prisma migrations: **62**
- Test files: **2** (21 tests, all unit-level on `lib/`)

## Suggested first PR after this audit
1. Add `requireAuth()` to the 19 highest-risk routes listed in §2 (payments, ledger, salary, uploads, parsing rules, batches, redistribution).
2. Add `requireAdmin()` to `users`, `clear-sessions`, `admin/backparse`.
3. Introduce `lib/sql/safe-identifier.ts` and migrate the 4 worst `$queryRawUnsafe` interpolations in §1.
4. Add `@upstash/ratelimit` to webhook + upload endpoints.

That delivers measurable risk reduction without touching the bigger refactors (Zod expansion, N+1, god-file split) that should each be their own PR.
