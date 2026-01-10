# Repository Guidelines

## Project Structure & Module Organization
The workspace is a pnpm monorepo with three core apps: `apps/webapp` hosts the Next.js UI (pages and components live in `app/` with co-located hooks and styles), `apps/server` exposes the Node API (HTTP routes in `src/routes`, business logic in `src/modules`), and `apps/workers` handles queues under `src/jobs`. Shared Prisma schema and migrations sit in `prisma/`, reusable types in `types/`, and Playwright suites in `tests/e2e/` alongside auth helpers.

## BOG GEL Bank Statement Processing - Three-Stage Approach

### Why Three Stages?
The bank statement processing has been restructured into three distinct stages to handle different scenarios:

**CASE 1: INN Found + Counteragent Exists**
- INN extracted from `docsender01inn`, `docsender01code`, `docreceiver01inn`, or `docreceiver01code`
- Counteragent found in database by INN
- Status: `counteragent_processed=TRUE`, `counteragent_inn` stored
- Action: Ready for rules/payment parsing

**CASE 2: INN Found + Counteragent Missing**
- INN found in raw data but no matching counteragent in database
- Status: `counteragent_processed=FALSE`, `counteragent_inn` stored
- Action: Requires manual counteragent creation before further processing
- Rationale: We have the INN but need to add the counteragent entity to the system

**CASE 3: No INN in Raw Data**
- No INN data available in any of the source fields
- Status: `counteragent_processed=FALSE`, `counteragent_inn=NULL`
- Action: Proceed directly to parsing rules and payment_id matching
- Rationale: Counteragent must be identified through business rules or payment associations

### Processing Stages

**Stage 1: Counteragent Identification**
- Extract INN from raw data fields (priority: sender01inn → sender01code → receiver01inn → receiver01code)
- Query counteragents table by INN
- Insert all records into consolidated_bank_accounts (counteragent_uuid can be NULL)
- Mark status in raw table: `counteragent_processed`, `counteragent_inn`
- Generate report of missing counteragents (CASE 2)

**Stage 2: Parsing Rules Application**
- Process records with `counteragent_processed=TRUE` OR (`counteragent_processed=FALSE` AND `counteragent_inn IS NULL`)
- Skip CASE 2 records (need counteragent added first)
- Match parsing scheme rules (e.g., `docprodgroup='COM'`)
- Validate counteragent compatibility: rule's counteragent must match identified counteragent
- Apply rule parameters: project_uuid, financial_code_uuid, nominal_currency_uuid
- Mark status: `parsing_rule_processed=TRUE`

**Stage 3: Payment ID Matching**
- Process records not matched by rules
- Extract payment_id from `docinformation` field
- Query payments table by payment_id
- Validate counteragent compatibility: payment's counteragent must match identified counteragent
- Apply payment parameters: project_uuid, financial_code_uuid, currency_uuid
- Mark status: `payment_id_processed=TRUE`

### Priority Hierarchy
1. **Counteragent** (FIRST): Identified from INN in raw data - cannot be overridden by rules or payments
2. **Parsing Rules** (SECOND): Must match identified counteragent, then apply other parameters
3. **Payment ID** (THIRD): Must match identified counteragent, then apply payment parameters

### Fully Processed Definition
A record is considered fully processed when ALL three flags are TRUE:
- `counteragent_processed=TRUE`
- `parsing_rule_processed=TRUE`
- `payment_id_processed=TRUE`

Or equivalently: `is_processed=TRUE` (derived from all three flags)

### Raw Table Columns
- `counteragent_processed`: Counteragent identified from INN
- `counteragent_inn`: INN value found in raw data (may not exist in counteragents table)
- `parsing_rule_processed`: Matched against parsing scheme rules
- `payment_id_processed`: Matched against payment_id or batch_id
- `is_processed`: TRUE when all three stages complete

### Scripts
- `process-bog-gel-counteragents-first.js`: Implements three-stage processing with detailed logging and CASE 2 reporting

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
