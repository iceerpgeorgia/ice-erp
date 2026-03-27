# Full Application Audit Report

**Application:** next-postgres-starter (ICE ERP Georgia)  
**Date:** March 23, 2026  
**Auditor:** Senior Software Engineer Review  
**Stack:** Next.js 14.2 + Prisma 6.16 + PostgreSQL + Supabase + NextAuth v4

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [CRITICAL: Security Vulnerabilities](#3-critical-security-vulnerabilities)
4. [Schema & Data Model Analysis](#4-schema--data-model-analysis)
5. [API Layer Analysis](#5-api-layer-analysis)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Frontend & UI Analysis](#7-frontend--ui-analysis)
8. [Cron Jobs & Background Processing](#8-cron-jobs--background-processing)
9. [Code Organization & Technical Debt](#9-code-organization--technical-debt)
10. [Testing Gap Analysis](#10-testing-gap-analysis)
11. [Performance Optimization Opportunities](#11-performance-optimization-opportunities)
12. [Discrepancy Report](#12-discrepancy-report)
13. [Prioritized Remediation Roadmap](#13-prioritized-remediation-roadmap)

---

## 1. EXECUTIVE SUMMARY

### Overall Grade: C+ (Functional but significant structural and security gaps)

| Area | Grade | Verdict |
|------|-------|---------|
| **Security** | **D** | Hardcoded secrets, 20+ unprotected API routes, no RBAC on core data |
| **Schema Design** | **B-** | Solid models with good indexing, but naming inconsistencies and missing FKs |
| **API Design** | **C** | Functional but inconsistent auth, validation, and error handling |
| **Frontend** | **B** | Clean component library (shadcn/ui), good Figma integration |
| **Code Organization** | **D** | 300+ orphaned scripts at project root, no monorepo structure despite docs claiming it |
| **Testing** | **F** | Near-zero test coverage; no unit, integration, or e2e tests found |
| **Performance** | **B-** | Good indexing strategy, but some N+1 patterns and heavy UNION queries |
| **DevOps/CI** | **C+** | Vercel deployment works, cron jobs configured, but no CI pipeline |

### Top 5 Critical Issues (Immediate Action Required)
1. **Hardcoded NEXTAUTH_SECRET in middleware.ts** — must be rotated immediately
2. **20+ API routes have NO authentication** — all dictionary & transaction endpoints are public
3. **300+ scripts at project root** polluting the codebase and leaking potential secrets
4. **Zero test coverage** — no safety net for any change
5. **Inconsistent dual-database architecture** without documented failover or sync guarantees

---

## 2. ARCHITECTURE OVERVIEW

### Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Vercel (Edge + Serverless)           │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │ Next.js Pages│  │  API Routes │  │  Cron Jobs   │   │
│  │  (SSR/CSR)   │  │  (~50 routes)│  │ (3 scheduled)│   │
│  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘   │
│         │                 │                 │            │
│  ┌──────┴─────────────────┴─────────────────┴──────┐    │
│  │              Prisma ORM + Raw SQL                │    │
│  └──────┬──────────────────────────┬───────────────┘    │
└─────────┼──────────────────────────┼────────────────────┘
          │                          │
   ┌──────▼──────┐           ┌──────▼──────┐
   │  Local PG   │           │  Supabase   │
   │ (Primary DB)│           │ (Remote DB) │
   │ consolidated│           │ raw records │
   │ dictionaries│           │ processing  │
   └─────────────┘           └─────────────┘
```

### Key Architectural Decisions

| Decision | Status | Assessment |
|----------|--------|------------|
| Dual database (Local PG + Supabase) | In production | **Risky** — data sync not guaranteed |
| JWT sessions (not DB) | Active | **Good** — reduces DB load |
| 14+ deconsolidated tables (per bank account) | Active | **Questionable** — consider partitioning |
| Python scripts for bank XML import | Active | **Functional but fragile** — no language consistency |
| Cookie-based insider selection | Active | **Insecure** — client can forge insider scope |

### Missing Architecture Components

- **No API gateway or rate limiting** — all routes are directly exposed
- **No request validation middleware** — each route validates independently
- **No centralized error handling** — inconsistent error responses
- **No health check endpoint** — no monitoring infrastructure
- **No message queue** — all processing is synchronous or cron-based
- **No caching layer** — every request hits the database
- **No API versioning** — breaking changes affect all consumers

---

## 3. CRITICAL: SECURITY VULNERABILITIES

### 3.1 HARDCODED SECRET (SEVERITY: CRITICAL)

**File:** `middleware.ts` line 4
```typescript
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'dhFhx/XLIvdcZxDMszlcRnXLd5CHEGq0LVkLdbo4kis=';
```

**Impact:** Anyone with repository access can forge JWT tokens and impersonate any user, including system_admin.

**Fix:**
- Immediately rotate the NEXTAUTH_SECRET in all environments
- Remove the hardcoded fallback entirely
- Require the env var; fail fast if not set
- Add secret scanning to CI (e.g., git-secrets, truffleHog)

### 3.2 MISSING AUTHENTICATION ON 20+ API ROUTES (SEVERITY: CRITICAL)

**Unprotected endpoints (accessible to anyone with the URL):**

| Route | Method | Data Exposed |
|-------|--------|-------------|
| `/api/counteragents` | GET/POST/PATCH/DELETE | All counteragent data (PII: names, INN, addresses, emails, phones) |
| `/api/financial-codes` | GET/POST/PATCH | All financial codes and hierarchy |
| `/api/currencies` | GET | Currency master data |
| `/api/banks` | GET | Bank information |
| `/api/countries` | GET/POST/PATCH | Country data |
| `/api/entity-types` | GET/POST/PATCH | Entity classifications |
| `/api/projects` | GET/POST/PATCH | All project data with financials |
| `/api/jobs` | GET/POST/PATCH | Job assignments |
| `/api/brands` | GET | Brand data |
| `/api/bank-transactions` | GET | **All bank transactions across all accounts** |
| `/api/bank-accounts` | GET | Bank account numbers and balances |
| `/api/counteragent-statement` | GET | Full counteragent transaction history |
| `/api/exchange-rates` | GET | Exchange rate data |
| `/api/missing-counteragents` | GET | Unmatched counteragent data |
| `/api/waybills` | GET/POST | Waybill data |
| `/api/waybill-items` | GET/POST | Waybill item details |
| `/api/inventories` | GET/POST | Inventory data |
| `/api/inventory-groups` | GET/POST | Inventory classifications |
| `/api/dimensions` | GET | Dimension data |
| `/api/project-states` | GET | Project state enums |

**Fix (standard pattern):**
```typescript
// Create a shared auth middleware
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function requireAuth(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}
```

Apply this to ALL API routes. Period.

### 3.3 COOKIE-BASED INSIDER SELECTION — FORGEABLE (SEVERITY: HIGH)

**File:** `lib/insider-selection.ts`

The insider UUID selection is stored in a **client-side cookie** with no server-side validation that the user is authorized to see that insider's data. A user could:
1. Intercept the cookie
2. Replace insider UUIDs with any existing UUID
3. Access data scoped to any insider in the system

**Fix:** Store insider permissions per-user in the database. Validate the cookie value against the user's authorized insider list on every request.

### 3.4 allowDangerousEmailAccountLinking (SEVERITY: MEDIUM)

**File:** `lib/auth.ts` line 33

This flag allows any Google account to link to an existing email in the database. If an attacker controls a Google account with the same email as an existing user, they can hijack that account.

**Fix:** Remove `allowDangerousEmailAccountLinking: true` and implement proper account linking flow with email verification.

### 3.5 ENVIRONMENT FILES IN REPOSITORY (SEVERITY: HIGH)

Multiple `.env.*` files exist in the repository root:
- `.env`, `.env.local`, `.env.production`, `.env.vercel`, `.env.vercel.production`, `.env.vercel.production2`

These may contain real credentials. Even if gitignored, their presence on disk suggests poor secrets management.

**Fix:**
- Verify ALL env files are in `.gitignore`
- Audit git history for any previously committed secrets
- Use a secrets manager (Vercel env vars, Vault, etc.)
- Delete all `.env.*` files except `.env.example`

### 3.6 CLIENT_SECRET FILE IN ROOT (SEVERITY: HIGH)

`client_secret_904189547818-*.apps.googleusercontent.com.json` — Google OAuth client secret file is at the project root.

**Fix:** Remove immediately. Store credentials in environment variables only.

---

## 4. SCHEMA & DATA MODEL ANALYSIS

### 4.1 Naming Convention Inconsistencies

The Prisma schema mixes three naming conventions:

| Convention | Examples | Count |
|------------|----------|-------|
| **PascalCase models** | `BankAccount`, `ConsolidatedBankAccount`, `User`, `Entry` | ~10 |
| **snake_case models** | `counteragents`, `currencies`, `financial_codes`, `payments` | ~15 |
| **Raw account models** | `bog_gel_raw_893486000`, `GE78BG0000000893486000_BOG_GEL` | ~14 |

**Standard practice:** Prisma models should be PascalCase. Use `@@map()` for database table names.

**Recommendation:**
```prisma
// CURRENT (inconsistent):
model counteragents { ... }
model BankAccount { @@map("bank_accounts") }

// RECOMMENDED (all PascalCase in Prisma):
model Counteragent { @@map("counteragents") }
model BankAccount  { @@map("bank_accounts") }
model Currency     { @@map("currencies") }
```

### 4.2 Missing Foreign Key Relationships

Several UUID reference columns lack Prisma `@relation` definitions:

| Table | Column | Missing FK To |
|-------|--------|---------------|
| `counteragents` | `country_uuid` | `countries.country_uuid` |
| `counteragents` | `entity_type_uuid` | `entity_types.entity_type_uuid` |
| `counteragents` | `insider_uuid` | `counteragents.counteragent_uuid` (self-ref) |
| `projects` | `counteragent_uuid` | `counteragents.counteragent_uuid` |
| `projects` | `financial_code_uuid` | `financial_codes.uuid` |
| `projects` | `currency_uuid` | `currencies.uuid` |
| `projects` | `state_uuid` | `project_states.uuid` |
| `projects` | `insider_uuid` | `counteragents.counteragent_uuid` |
| `payments` | `project_uuid` | `projects.project_uuid` |
| `payments` | `counteragent_uuid` | `counteragents.counteragent_uuid` |
| `payments` | `financial_code_uuid` | `financial_codes.uuid` |
| `payments` | `currency_uuid` | `currencies.uuid` |
| `payments` | `job_uuid` | `jobs.job_uuid` |
| `payments` | `insider_uuid` | `counteragents.counteragent_uuid` |
| `ConsolidatedBankAccount` | `counteragentUuid` | `counteragents.counteragent_uuid` |
| `ConsolidatedBankAccount` | `projectUuid` | `projects.project_uuid` |
| `ConsolidatedBankAccount` | `financialCodeUuid` | `financial_codes.uuid` |
| `ConsolidatedBankAccount` | `nominalCurrencyUuid` | `currencies.uuid` |
| `ConsolidatedBankAccount` | `insiderUuid` | `counteragents.counteragent_uuid` |
| `salary_accruals` | `counteragent_uuid` | `counteragents.counteragent_uuid` |
| `salary_accruals` | `financial_code_uuid` | `financial_codes.uuid` |
| `salary_accruals` | `insider_uuid` | `counteragents.counteragent_uuid` |
| `jobs` | `project_uuid` | `projects.project_uuid` |
| `jobs` | `insider_uuid` | `counteragents.counteragent_uuid` |

**Impact:** No referential integrity at the database level. Orphaned records can exist silently.

**Recommendation:** Add `@relation` for all UUID-based references. Use `onDelete: Restrict` to prevent orphaning.

### 4.3 Typos in Schema

| Field | Table | Issue |
|-------|-------|-------|
| `is_emploee` | `counteragents` | Misspelled — should be `is_employee` |
| `was_emploee` | `counteragents` | Misspelled — should be `was_employee` |

These typos propagate through the entire codebase (API, frontend, imports).

### 4.4 Denormalization Issues in `counteragents`

The `counteragents` table stores both UUIDs and denormalized text values:

```prisma
country_uuid    String?  @db.Uuid    // FK to countries
country         String?               // Denormalized country name
entity_type_uuid String? @db.Uuid    // FK to entity_types  
entity_type     String?               // Denormalized entity type name
counteragent    String?               // Denormalized display name (from what?)
```

**Risk:** Data drift — the denormalized text may not match the UUID reference.

**Recommendation:** Remove denormalized columns. Join at query time or use a materialized view.

### 4.5 Duplicate UUID Patterns

The project uses two incompatible UUID patterns:

| Pattern | Example | Tables |
|---------|---------|--------|
| `uuid` column with `@default(dbgenerated("gen_random_uuid()"))` | `BankAccount.uuid` | bank_accounts, brands, jobs, dimensions |
| Named UUID column like `country_uuid`, `project_uuid` | `countries.country_uuid` | countries, projects, entity_types |

**Recommendation:** Standardize on one pattern. Use `uuid` as the column name everywhere with `@@map()` for DB names if needed.

### 4.6 Missing `updatedAt` Auto-Update

Many models have `updated_at` / `updatedAt` columns but NO `@updatedAt` directive:

```prisma
// CURRENT (broken auto-update):
updated_at DateTime @default(now())  // Only set on INSERT, never updated

// CORRECT:
updated_at DateTime @updatedAt       // Prisma auto-updates on every write
```

**Affected models:** `brands`, `salary_accruals`, `payments_ledger`, `rs_waybills_in`, `inventories`, `inventory_groups`, `dimensions`, `rs_waybills_in_items`, bog raw tables

### 4.7 `transactionDate` Stored as String

```prisma
model ConsolidatedBankAccount {
  transactionDate String @map("transaction_date")  // Should be DateTime @db.Date
}
```

**Impact:** Cannot use date range queries efficiently. All date comparisons require casting. Index on this column is ineffective for date operations.

### 4.8 14+ Deconsolidated Tables — Anti-Pattern

Having separate tables per bank account (`GE78BG0000000893486000_BOG_GEL`, `GE65TB7856036050100002_TBC_GEL`, etc.) is a **table-per-tenant anti-pattern**.

**Problems:**
- Every new bank account requires DDL changes (new migration, new model)
- UNION queries grow linearly with new accounts
- The API must hardcode table names and offsets
- Schema drift between table copies

**Better Approach:** Single `deconsolidated_transactions` table with a `bank_account_uuid` column and PostgreSQL table partitioning:

```sql
CREATE TABLE deconsolidated_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY,
  bank_account_uuid UUID NOT NULL,
  raw_record_uuid UUID NOT NULL,
  -- all common columns...
  PRIMARY KEY (bank_account_uuid, id)
) PARTITION BY LIST (bank_account_uuid);

CREATE TABLE deconsolidated_bog_gel_893 PARTITION OF deconsolidated_transactions
  FOR VALUES IN ('uuid-of-893-account');
```

---

## 5. API LAYER ANALYSIS

### 5.1 Inconsistent Response Formats

| Route | Success Format | Error Format |
|-------|---------------|-------------|
| `/api/counteragents` GET | `[{...}, {...}]` (raw array) | `{ error: "..." }` |
| `/api/payments` GET | `[{...}]` (raw array) | `{ error: "..." }` |
| `/api/users` GET | `{ users: [...] }` (wrapped) | `{ error: "..." }` |
| `/api/bank-transactions` GET | `{ transactions: [...], balances: {...}, debug: {...} }` (wrapped) | `{ error: "..." }` |

**Recommendation:** Standardize on envelope format:
```typescript
// Success:
{ data: T, meta?: { total, page, pageSize } }
// Error:
{ error: { code: string, message: string, details?: any } }
```

### 5.2 No Input Validation Framework

Most routes manually validate inputs:
```typescript
if (!counteragentUuid || !financialCodeUuid) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}
```

**Recommendation:** Use Zod schemas (already a dependency) as middleware:
```typescript
// schemas/payments.ts
const CreatePaymentSchema = z.object({
  counteragentUuid: z.string().uuid(),
  financialCodeUuid: z.string().uuid(),
  currencyUuid: z.string().uuid(),
  incomeTax: z.boolean(),
  projectUuid: z.string().uuid().optional(),
});

// In route handler:
const result = CreatePaymentSchema.safeParse(body);
if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
```

The project already has `lib/zod_schemas.ts` but it's barely used in API routes.

### 5.3 Excessive Use of `$queryRawUnsafe`

**20+ API files use `$queryRawUnsafe`** — this bypasses Prisma's type safety and query builder. While the actual queries use parameterized `$1, $2` placeholders in most cases, the pattern is risky because:

1. It's easy to accidentally interpolate user input
2. No TypeScript type checking on query results
3. No query plan optimization by Prisma

**Recommendation:** For complex queries, use `$queryRaw` (tagged template literal) which auto-parameterizes:
```typescript
// RISKY (current):
prisma.$queryRawUnsafe(`SELECT * FROM t WHERE id = $1`, id)

// SAFER (recommended):
prisma.$queryRaw`SELECT * FROM t WHERE id = ${id}`
```

### 5.4 Missing HTTP Method Restrictions

Many route files export handlers for methods that shouldn't be allowed. For example, dictionary routes that should be read-only for non-admin users expose POST/PATCH/DELETE without role checks.

### 5.5 No Rate Limiting

No rate limiting exists on any endpoint. A single client could hammer the database or overwhelm cron jobs.

**Recommendation:** Add Vercel's built-in rate limiting or implement token bucket at the API layer.

---

## 6. AUTHENTICATION & AUTHORIZATION

### 6.1 Current Auth Architecture

```
User → Google OAuth → NextAuth JWT → Session
                                        │
       ┌────────────────────────────────┤
       │                                │
  Protected Routes              Unprotected Routes
  (session.user.email)          (20+ endpoints)
       │                                │
  ┌────┴────┐                    ┌──────┴──────┐
  │ RBAC    │                    │ NO CHECKS   │
  │ (admin  │                    │ (public)    │
  │  only)  │                    └─────────────┘
  └─────────┘
```

### 6.2 Role System — Incomplete

Three roles exist: `user`, `admin`, `system_admin`

| Role | Capabilities (Actual) |
|------|----------------------|
| `system_admin` | Manage users via `/api/users` |
| `admin` | **Same as `user`** — no admin-specific features |
| `user` | Access protected routes (payments-ledger, salary, services-report) |
| **Anonymous** | **Access ALL dictionary and transaction endpoints** |

**Problem:** The `admin` role has no distinct permissions. The `user` role has almost no restrictions because most routes are unprotected.

### 6.3 Middleware Only Protects `/dashboard`

```typescript
export const config = {
  matcher: ["/dashboard"],
};
```

This means only the `/dashboard` page requires sign-in. All `/dictionaries/*`, `/bank-transactions`, `/counteragent-statement`, `/payment-statement`, `/salary-report` pages are accessible without authentication (they may fetch from unprotected APIs anyway).

**Recommendation:** Expand middleware matcher:
```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/dictionaries/:path*',
    '/bank-transactions/:path*',
    '/counteragent-statement/:path*',
    '/payment-statement/:path*',
    '/salary-report/:path*',
    '/api/((?!auth|cron).*)',  // Protect all API routes except auth and cron
  ],
};
```

### 6.4 No CSRF Protection on Mutations

POST/PATCH/DELETE operations have no CSRF token validation. NextAuth provides CSRF for its own routes, but custom API routes lack it.

---

## 7. FRONTEND & UI ANALYSIS

### 7.1 Strengths

- **shadcn/ui component library** — well-structured, accessible components based on Radix UI
- **Figma integration** — design-to-code pipeline for table layouts
- **Tailwind CSS** — consistent utility-first styling
- **TypeScript** — strict mode enabled

### 7.2 Issues

**7.2.1 Root page uses client-side rendering unnecessarily**
```typescript
// app/page.tsx — "use client"
```
The home page with insider selection could be a server component with selective client interactivity.

**7.2.2 No loading/error boundaries**
No `loading.tsx` or `error.tsx` files found in any route segment. Users see blank screens during navigation.

**7.2.3 No metadata on most pages**
Only a few pages export metadata. Most pages lack proper `<title>` and Open Graph tags.

**7.2.4 Component organization**
Components are split between:
- `components/` (top-level, 6 files)
- `components/ui/` (50+ shadcn components)
- `app/dictionaries/*/` (page-specific components co-located)
- `app/bank-transactions/` (page-specific components)

**Recommendation:** Establish clear boundaries:
- `components/ui/` — Generic reusable (shadcn)
- `components/features/` — Feature-specific shared components
- `app/*/` — Page-specific components (co-location is fine)

### 7.3 Missing Frontend Features

- **No global error boundary** — unhandled errors crash the entire app
- **No toast/notification system** — users don't see success/failure feedback on mutations
- **No optimistic updates** — all mutations wait for server response
- **No data fetching library** (SWR/React Query) — manual `fetch()` with `useEffect` everywhere
- **No form state management** — `react-hook-form` is a dependency but usage is limited

---

## 8. CRON JOBS & BACKGROUND PROCESSING

### 8.1 Current Cron Jobs

| Job | Schedule | Duration Limit | Risk |
|-----|----------|----------------|------|
| BOG Import Last 3 Days | Daily 3 AM | 300s | **HIGH** — processes 14+ accounts sequentially |
| Update NBG Rates | Daily 4 PM | default | LOW — single API call + upsert |
| Cash-Based Monthly Accruals | Sundays 10 AM | default | MEDIUM — complex SQL aggregation |

### 8.2 Cron Security

CRON_SECRET is verified via bearer token + Vercel cron header. This is adequate for Vercel infrastructure.

### 8.3 BOG Import Risks

- **300s timeout** may be insufficient for 14+ accounts x 3 days
- **Sequential processing** — each account/day waits for the previous one
- **No retry mechanism** — if one account fails, no automatic retry
- **No idempotency guarantee** — duplicate detection is UUID-based but race conditions possible

**Recommendation:**
- Process accounts in parallel (Promise.all batch of 3-4)
- Add exponential retry with dead-letter logging
- Add a health check endpoint that reports last successful import time

---

## 9. CODE ORGANIZATION & TECHNICAL DEBT

### 9.1 Root Directory Pollution (SEVERITY: HIGH)

**The project root contains 300+ utility scripts** that should NOT be there:

| Category | Count | Examples |
|----------|-------|---------|
| `check-*` scripts | ~80 | check-bank-columns.js, check_schema.py |
| `apply-*` migration scripts | ~30 | apply-bank-migrations.py, apply-parsing-migration.js |
| `copy-*` data scripts | ~15 | copy-bank-accounts-from-supabase.js |
| `fix-*` hotfix scripts | ~20 | fix-nominal-amounts.py, fix-prisma-windows.ps1 |
| `sync-*` sync scripts | ~10 | sync-raw-data-to-supabase.js |
| `analyze-*` analysis scripts | ~10 | analyze_consolidated_vs_raw.py |
| Debug/temp logs | ~20 | Server_Debug.txt, backparse_debug.log |
| Excel data files | ~10 | BOG_Statement_Analysis.xlsx |
| PDF/doc files | ~5 | File_description_EN.pdf |

**Impact:**
- Impossible to understand project structure at a glance
- Sensitive data may be in Excel/CSV files
- Scripts may contain hardcoded credentials
- Confuses tooling (linting, type checking, bundling)

**Recommendation:**
1. Move ALL scripts to `scripts/` with subdirectories: `scripts/migrations/`, `scripts/analysis/`, `scripts/sync/`, `scripts/checks/`
2. Delete all temporary files: logs, debug output, Excel exports
3. Add to `.gitignore`: `*.xlsx`, `*.csv`, `*.log`, `*.txt` (at root level)
4. Move documentation to `docs/`

### 9.2 Monorepo Claim vs Reality

`AGENTS.md` describes a **pnpm monorepo with three apps**: `apps/webapp`, `apps/server`, `apps/workers`.

**Reality:** The project is a **single Next.js application** with no `apps/` directory, no `pnpm-workspace.yaml`, no `turbo.json`. The monorepo structure described in documentation does not exist.

**Recommendation:** Either:
- (A) Implement the monorepo structure described in docs, OR
- (B) Update AGENTS.md to reflect the actual single-app structure

### 9.3 Mixed Language Stack

The project uses both TypeScript/JavaScript AND Python for data processing:

| Language | Purpose | Files |
|----------|---------|-------|
| TypeScript | API routes, frontend, some data scripts | 200+ |
| JavaScript | Legacy scripts, some API routes | 165+ |
| Python | Bank XML import, data analysis, NBG rates | 100+ |
| SQL | Raw migrations, constraints, triggers | 15-20 |

**Problem:** Two runtime environments (Node.js + Python) must be maintained, with data processing split between them. The Python scripts require a separate `.venv` environment.

**Recommendation:** Gradually consolidate to TypeScript. The `lib/bank-import/` TypeScript modules already replicate most Python functionality. Complete the migration.

### 9.4 Duplicate Implementation

Several features are implemented in both JS and Python:

| Feature | JS File | Python File |
|---------|---------|-------------|
| Bank XML import | `lib/bank-import/import_bank_xml_data_deconsolidated.ts` | `import_bank_xml_data.py` |
| Account extraction | `scripts/parse-bog-gel-comprehensive.js` | `test_account_extraction.py` |
| NBG rate updates | `app/api/cron/update-nbg-rates/route.ts` | `scripts/update-nbg-rates.py` |
| Counteragent processing | `scripts/process-bog-gel-counteragents-first.js` | `import_bank_xml_data.py` |

**Impact:** Changes must be made in two places. Logic drift between implementations.

### 9.5 Dead Code

- `_deploy-log/` directory — appears to be a full copy of the project
- `Payments Report Figma/` — contains its own package.json
- `test-tailwind/` — test sandbox
- `Chrome Logs/`, `Problem Videos/`, `Vercel Logs/` — debug artifacts

---

## 10. TESTING GAP ANALYSIS

### 10.1 Current State

| Test Type | Status | Files Found |
|-----------|--------|-------------|
| Unit Tests | **NONE** | `app/__tests__/` exists but empty or minimal |
| Integration Tests | **NONE** | No API route tests found |
| E2E Tests | **NONE** | `e2e/` directory exists but no test files |
| Python Tests | **1 file** | `test_account_extraction.py` (7 tests) |

**jest.config.js** is configured but no test files match the pattern `**/*.test.ts(x)`.
**playwright.config.ts** exists but `e2e/` directory has no spec files.

### 10.2 Critical Test Gaps

| Area | Risk | Priority |
|------|------|----------|
| Bank transaction processing (3-phase) | Data corruption | **P0** |
| Payment ID generation & validation | Duplicate IDs | **P0** |
| Auth middleware & session checks | Security bypass | **P0** |
| BTC_ batch partitioning logic | Data loss | **P1** |
| Cron job idempotency | Duplicate imports | **P1** |
| Exchange rate calculation | Financial accuracy | **P1** |
| Insider selection scoping | Data leakage | **P1** |
| CRUD operations on all dictionaries | Data integrity | **P2** |

### 10.3 Minimum Test Suite Recommendation

```
tests/
├── unit/
│   ├── lib/
│   │   ├── formula-compiler.test.ts
│   │   ├── insider-selection.test.ts
│   │   ├── audit.test.ts
│   │   └── bank-import/
│   │       ├── db-utils.test.ts
│   │       └── bog-gel-processor.test.ts
│   └── utils/
│       └── date-helpers.test.ts
├── integration/
│   ├── api/
│   │   ├── auth.test.ts
│   │   ├── counteragents.test.ts
│   │   ├── payments.test.ts
│   │   ├── bank-transactions.test.ts
│   │   └── users.test.ts
│   └── cron/
│       ├── bog-import.test.ts
│       └── nbg-rates.test.ts
└── e2e/
    ├── auth-flow.spec.ts
    ├── dictionary-crud.spec.ts
    └── bank-statement-import.spec.ts
```

---

## 11. PERFORMANCE OPTIMIZATION OPPORTUNITIES

### 11.1 Database Query Optimization

**Issue 1: UNION ALL of 14 tables in bank-transactions route**

Every request to `/api/bank-transactions` executes a massive UNION ALL across 14 tables with two SELECT blocks each (regular + batch). This is ~28 SELECT statements per request.

**Fix:** Use PostgreSQL table partitioning (see Section 4.8) or create a materialized view refreshed on insert.

**Issue 2: N+1 query pattern in counteragent enrichment**

The `enrichWithInsiderName()` function in counteragents route batch-loads insider names, but other routes (projects, jobs) may not do this consistently.

**Fix:** Use Prisma includes or SQL JOINs consistently.

**Issue 3: No pagination defaults on large tables**

Several routes return all records by default without pagination:
- `/api/counteragents` — all counteragents
- `/api/financial-codes` — all codes with tree building
- `/api/projects` — all projects

**Fix:** Add default `limit=100` and require explicit pagination.

### 11.2 Caching Opportunities

| Resource | TTL | Strategy |
|----------|-----|----------|
| Exchange rates | 1 hour | CDN cache or in-memory |
| Financial codes tree | 5 min | Stale-while-revalidate |
| Countries/Entity types | 24 hours | Static generation |
| Currencies | 24 hours | Static generation |
| Parsing scheme rules | 5 min | In-memory cache |

**Implementation:** Use Next.js `unstable_cache` or SWR on the client:
```typescript
// Server-side:
import { unstable_cache } from 'next/cache';
const getCurrencies = unstable_cache(
  async () => prisma.currencies.findMany({ where: { is_active: true } }),
  ['currencies'],
  { revalidate: 86400 }
);
```

### 11.3 Bundle Size Optimization

The `xlsx` library (~2MB) is imported on the server side for Excel import/export. Consider:
- Using `exceljs` (smaller, streaming)
- Lazy-loading the library only when export is requested
- Moving Excel processing to a separate API route (code-split)

### 11.4 Connection Pooling

**File:** `lib/prisma.ts`

The Prisma client auto-adds `pgbouncer=true` and `connection_limit=1` when using Supabase URLs. This is correct for serverless but may throttle concurrent requests.

**Recommendation:** Use Prisma Accelerate or Supabase connection pooler explicitly instead of manual URL manipulation.

---

## 12. DISCREPANCY REPORT

### 12.1 Documentation vs Reality

| Claim (AGENTS.md) | Reality | Impact |
|---|---|---|
| "pnpm monorepo with three core apps" | Single Next.js app, no monorepo | Misleading for new developers |
| "apps/webapp", "apps/server", "apps/workers" | These directories don't exist | Documentation is fiction |
| "Shared Prisma schema in prisma/" | Correct | N/A |
| "Playwright suites in tests/e2e/" | Directory exists but no tests | False confidence |
| "pnpm lint for ESLint + Prettier" | Prettier not configured | Inconsistent formatting |
| "Co-locate Jest specs as *.test.ts(x)" | No test files exist | Zero coverage |

### 12.2 Schema vs API Discrepancies

| Schema Definition | API Behavior | Issue |
|---|---|---|
| `counteragents.is_emploee` (typo) | API uses `is_emploee` | Typo propagated everywhere |
| `projects` has no FK to `counteragents` | API joins on UUID strings | No referential integrity |
| `payments.payment_id` is `@unique` | API validates format manually | Should use DB constraint |
| `ConsolidatedBankAccount.transactionDate` is `String` | API does date comparisons | Should be `DateTime @db.Date` |
| `BankAccount.parsingSchemeId` is `BigInt` | Not used in any API route | Dead column |

### 12.3 Prisma vs Database Discrepancies

The 4 database triggers (BTC enforcement, correction date, batch partitions, single batch per record) are maintained **outside** Prisma's control in raw SQL migrations. Prisma is unaware of these constraints, so:

- `prisma db push` would NOT create these triggers
- Schema introspection won't show them
- Any schema reset would lose the triggers

**Fix:** Document all triggers in a `prisma/triggers.sql` file and include in CI/CD.

### 12.4 Dual Database Sync Issues

| Data | Primary Location | Synced To | Sync Method | Risk |
|------|-----------------|-----------|-------------|------|
| Raw bank records | Supabase | Local | Python script (manual) | **Stale local data** |
| Counteragents | Supabase | Local (Prisma) | Not synced automatically | **Data drift** |
| Parsing rules | Supabase | Local | Python script (manual) | **Rules out of date** |
| Consolidated records | Local | Not synced to Supabase | N/A | **Single point of failure** |
| Exchange rates | Local (Prisma) | Not synced to Supabase | N/A | Reports may differ |

---

## 13. PRIORITIZED REMEDIATION ROADMAP

### Phase 1: Critical Security Fixes (Week 1)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **Rotate NEXTAUTH_SECRET**, remove hardcoded fallback from middleware.ts | 1h | Critical |
| 2 | **Add auth middleware to ALL API routes** — create shared `requireAuth()` helper | 4h | Critical |
| 3 | **Remove `client_secret*.json`** from root and git history | 1h | Critical |
| 4 | **Audit `.env*` files** — ensure none are tracked in git | 1h | Critical |
| 5 | **Remove `allowDangerousEmailAccountLinking`** | 30m | High |
| 6 | **Server-side insider validation** — verify user's authorized insiders against DB | 4h | High |

### Phase 2: Data Integrity (Weeks 2-3)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 7 | Add missing FK relations in Prisma schema (15+ columns) | 8h | High |
| 8 | Fix `transactionDate` from String to DateTime | 4h | High |
| 9 | Fix `is_emploee` → `is_employee` typo (schema + all references) | 4h | Medium |
| 10 | Add `@updatedAt` to all models with `updated_at` columns | 2h | Medium |
| 11 | Standardize UUID patterns across all models | 4h | Medium |
| 12 | Add Zod validation to all POST/PATCH/DELETE routes | 8h | High |

### Phase 3: Code Organization (Weeks 3-4)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 13 | Move 300+ root scripts to `scripts/` subdirectories | 4h | High |
| 14 | Delete temp files (logs, debug output, Excel exports from root) | 2h | Medium |
| 15 | Update AGENTS.md to reflect actual architecture | 2h | Medium |
| 16 | Remove dead directories (`_deploy-log/`, `test-tailwind/`, `Chrome Logs/`) | 1h | Low |
| 17 | Standardize Prisma model naming to PascalCase | 4h | Medium |
| 18 | Consolidate duplicate JS/Python implementations | 16h | Medium |

### Phase 4: Testing Foundation (Weeks 4-6)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 19 | Write auth middleware tests (unit) | 4h | Critical |
| 20 | Write bank transaction processing tests | 8h | Critical |
| 21 | Write payment ID validation tests | 4h | High |
| 22 | Write API integration tests for CRUD routes | 16h | High |
| 23 | Write E2E test for bank import flow | 8h | Medium |
| 24 | Set up CI pipeline with test gates | 4h | High |

### Phase 5: Performance & Architecture (Weeks 6-8)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 25 | Implement API response caching for dictionaries | 4h | Medium |
| 26 | Add pagination defaults to all list endpoints | 4h | Medium |
| 27 | Evaluate table partitioning for deconsolidated tables | 16h | High |
| 28 | Add rate limiting to API routes | 4h | Medium |
| 29 | Implement SWR/React Query on frontend | 8h | Medium |
| 30 | Add loading.tsx and error.tsx to all route segments | 4h | Low |

### Phase 6: Architecture Modernization (Months 2-3)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 31 | Resolve dual-database architecture — single source of truth | 40h | High |
| 32 | Migrate remaining Python scripts to TypeScript | 40h | Medium |
| 33 | Implement proper RBAC with permissions matrix | 16h | High |
| 34 | Add API versioning | 8h | Medium |
| 35 | Implement proper observability (logging, metrics, tracing) | 16h | Medium |

---

## APPENDIX A: Complete Model Relationship Diagram

```
User ──────────── Account (NextAuth)
  │                Session (NextAuth)
  │                Entry
  │
  ├─── AuditLog (via user_email)
  │
counteragents ─── transactions ─── financial_codes
  │                                     │
  ├─── projects ──── project_employees  │
  │       │                             │
  │       ├── jobs ── brands            │
  │       │    │                        │
  │       │    └── job_projects         │
  │       │                             │
  ├─── payments ────────────────────────┘
  │       │
  │       └── payments_ledger
  │
  ├─── salary_accruals ── currencies
  │
  └─── rs_waybills_in ── rs_waybills_in_items ── inventories
                                                      │
                                                 inventory_groups ── dimensions

Bank ── BankAccount ── BankAccountBalance
            │
            ├── ConsolidatedBankAccount
            │
            └── [14 deconsolidated tables] ── bank_transaction_batches
                                                    │
                                              conversion_entries

parsing_schemes ── parsing_scheme_rules
nbg_exchange_rates
countries
entity_types
currencies
document_types
project_states
mi_dimensions
```

## APPENDIX B: Security Checklist

- [ ] Rotate NEXTAUTH_SECRET in all environments
- [ ] Remove hardcoded secret from middleware.ts
- [ ] Add authentication to all 20+ unprotected API routes
- [ ] Remove client_secret JSON from repository
- [ ] Audit git history for leaked secrets
- [ ] Remove allowDangerousEmailAccountLinking
- [ ] Implement server-side insider authorization
- [ ] Add CSRF protection to mutation endpoints
- [ ] Add rate limiting
- [ ] Add Content Security Policy headers
- [ ] Implement request logging for audit trail
- [ ] Add input validation (Zod) to all mutation endpoints
- [ ] Review all $queryRawUnsafe usages for injection risk
- [ ] Add API key authentication for cron endpoints (defense in depth)
- [ ] Implement proper RBAC (admin vs user permissions)

---

*End of Audit Report*
