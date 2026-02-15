# Repository Guidelines

## Project Structure & Module Organization
The workspace is a pnpm monorepo with three core apps: `apps/webapp` hosts the Next.js UI (pages and components live in `app/` with co-located hooks and styles), `apps/server` exposes the Node API (HTTP routes in `src/routes`, business logic in `src/modules`), and `apps/workers` handles queues under `src/jobs`. Shared Prisma schema and migrations sit in `prisma/`, reusable types in `types/`, and Playwright suites in `tests/e2e/` alongside auth helpers.

## BOG GEL Bank Statement Processing - Three-Stage Approach

### Consolidated Processing Architecture
All BOG GEL XML import and processing logic is consolidated into `import_bank_xml_data.py`, which implements a three-phase hierarchy:

**Phase 1: Counteragent Identification** (HIGHEST PRIORITY - Cannot be overridden)
- Extract INN from raw data fields based on transaction direction
  - Incoming payment (debit=NULL): Use DocSenderInn
  - Outgoing payment (debit>0): Use DocBenefInn
- Normalize INN (prepend '0' if 10 digits)
- Query counteragents table by INN
- Extract counteragent account from DocCorAcct (primary) or DocSenderAcctNo/DocBenefAcctNo (fallback)

**Phase 2: Parsing Rules Application** (SECOND PRIORITY)
- Query parsing_scheme_rules table for active rules
- Match rules based on parameters (e.g., DocProdGroup='COM')
- If rule counteragent conflicts with Phase 1 counteragent → KEEP Phase 1, flag conflict
- Apply rule parameters: project_uuid, financial_code_uuid, nominal_currency_uuid

**Phase 3: Payment ID Matching** (LOWEST PRIORITY)
- Extract payment_id from DocInformation field (regex patterns)
- Query payments table by payment_id
- If payment counteragent conflicts with Phase 1 counteragent → KEEP Phase 1, flag conflict
- Apply payment parameters only if not already set by Phase 2

### Case Definitions

### Case Definitions

**CASE 1: INN Found + Counteragent Exists**
- INN extracted from DocSenderInn/DocBenefInn based on transaction direction
- Counteragent found in database by normalized INN
- Status: `counteragent_processed=TRUE`, `counteragent_inn` stored
- Action: Ready for Phase 2 (rules) and Phase 3 (payment) processing

**CASE 2: INN Found + Counteragent Missing**
- INN found in raw data but no matching counteragent in database
- Status: `counteragent_processed=FALSE`, `counteragent_inn` stored
- Action: Requires manual counteragent creation before full processing
- Rationale: We have the INN but need to add the counteragent entity to the system

**CASE 3: No INN in Raw Data**
- No INN data available in DocSenderInn or DocBenefInn fields
- Status: `counteragent_processed=FALSE`, `counteragent_inn=NULL`
- Action: Proceed directly to Phase 2 (parsing rules) and Phase 3 (payment_id matching)
- Rationale: Counteragent must be identified through business rules or payment associations

### Hierarchy and Conflict Resolution

The three-phase hierarchy ensures data integrity:

1. **Counteragent is KING**: Once identified in Phase 1, it CANNOT be overridden by Phase 2 (rules) or Phase 3 (payment)
2. **Conflict Detection**: If rule or payment suggests different counteragent → flag conflict, keep Phase 1 counteragent
3. **Complementary Data**: Rules and payments can ADD project_uuid, financial_code_uuid if not conflicting
4. **Fully Processed**: Record is fully processed when all three flags are TRUE: `counteragent_processed`, `parsing_rule_processed`, `payment_id_processed`

### Processing Stages

**Stage 1: XML Parsing and Raw Data Insertion**
- Parse BOG XML bank statements
- Extract all fields from <DETAIL> elements
- Generate UUID from DocKey + EntriesId
- Check for duplicates (DocKey + EntriesId combination)
- Insert into `bog_gel_raw_*` table (Supabase)
- Initialize all processing flags to FALSE

**Stage 2: Dictionary Loading**
- Load counteragents map (INN → counteragent_uuid, name)
- Load parsing_scheme_rules (active rules with parameters)
- Load payments map (payment_id → counteragent, project, financial_code, currency)

**Stage 3: Three-Phase Processing Loop**
- For each raw record:
  * Phase 1: Identify counteragent by INN
  * Phase 2: Match parsing rules (check conflicts)
  * Phase 3: Match payment_id (check conflicts)
  * Generate consolidated record with all gathered data
  * Update raw table processing flags

**Stage 4: Consolidated Table Insertion**
- Insert all consolidated records to `consolidated_bank_accounts` (Local DB)
- Include counteragent_uuid, project_uuid, financial_code_uuid, payment_id
- Store transaction_date, amounts, description, IDs

**Stage 5: Raw Table Flag Updates**
- Update `bog_gel_raw_*` table (Supabase) with processing flags
- Mark counteragent_processed, parsing_rule_processed, payment_id_processed
- Set is_processed=TRUE when all three phases complete

### Priority Hierarchy
1. **Counteragent** (FIRST): Identified from INN in raw data - cannot be overridden by rules or payments
2. **Parsing Rules** (SECOND): Must not conflict with counteragent, then apply other parameters
3. **Payment ID** (THIRD): Must not conflict with counteragent, then apply payment parameters

### Statement & Payment ID Constraints
- **Never surface BTC_ batch IDs as `payment_id`** in any statement view (counteragent, payment ID, salary payment ID).
- When a transaction has a BTC_ batch ID, resolve and display the **partition payment IDs** instead, and propagate those IDs into all payment-id-related fields.
- All statement rendering, filtering, and aggregate calculations (including payments report paid sums) must **exclude BTC_ batch IDs** and operate on resolved partition payment IDs.

### Batch Payment ID Resolution (BTC_)
If a deconsolidated row has `payment_id` starting with `BTC_`, it represents a batch and **must be expanded** using `bank_transaction_batches`:
1. Lookup partitions by `raw_record_uuid` (or `raw_record_id_1`/`raw_record_id_2`).
2. Replace the single BTC_ row with **one row per partition** using the partition `payment_id` (or the payment linked by `payment_uuid`).
3. Any UI column or calculation that uses payment IDs must use these resolved partition payment IDs and **never** the BTC_ value.

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
- `payment_id_processed`: Matched against payment_id
- `is_processed`: TRUE when all three stages complete

### Scripts
- `import_bank_xml_data.py`: ✅ **PRODUCTION READY** - Comprehensive script that consolidates ALL processing logic:
  * Account identification from XML (aligned with working JS implementation)
  * XML parsing and raw data insertion
  * Three-phase processing with hierarchy (Counteragent → Rules → Payment)
  * Consolidated table insertion (LOCAL database)
  * Conflict detection and reporting
  * Batch operations with performance optimization
  * Detailed logging with step timing and ETA
  * **CLI Modes**:
    - `python import_bank_xml_data.py import <xml_file>` - Parse XML and process
    - `python import_bank_xml_data.py backparse [--account-uuid UUID] [--batch-id ID] [--clear]` - Reprocess existing raw data (LOCAL only)
  
**Supporting Scripts**:
- `test_account_extraction.py`: Test suite validating account extraction logic (7/7 tests passing)
- `COMPARISON_JS_VS_PYTHON.md`: Detailed comparison showing alignment with JavaScript implementation

**Re Scripts** (proven working logic, used as reference):
- `scripts/process-bog-gel-counteragents-first.js`: Original three-stage processor (Python implementation now matches this)
- `scripts/parse-bog-gel-comprehensive.js`: Original comprehensive parser (Python implementation now matches this)

## Build, Test, and Development Commands
Install depeferencendencies once with `pnpm i`. Use `pnpm dev` to launch web, API, and workers concurrently while developing. Whenever `prisma/schema.prisma` changes, run `pnpm prisma migrate dev --name <feature>` followed by `pnpm prisma generate` to refresh the client. After adding new models to the schema, run `python scripts/auto-generate-templates.py` to automatically create Excel import templates in the `templates/` folder. Execute `pnpm test` for Jest coverage and `pnpm test:e2e` when end-to-end verification is required; append `--watch` for quick feedback loops.

## Coding Style & Naming Conventions
All code is TypeScript and must satisfy the shared ESLint + Prettier rules via `pnpm lint` or `pnpm lint --fix`. Name files in kebab-case (`user-profile.ts`), React components in PascalCase (`UserProfile.tsx`), and variables or functions in camelCase. Keep comments purposeful: explain non-obvious invariants, integration quirks, or domain rules.

## Testing Guidelines
Favor tests on public contracts: API handlers, Prisma services, and UI state reducers. Co-locate Jest specs as `*.test.ts(x)` near their source or under `tests/`, and refresh fixtures in `tests/fixtures/` when behavior shifts. Capture cross-surface flows, including auth, with Playwright specs; start `pnpm dev` before launching them to ensure all services are available.

## Commit & Pull Request Guidelines
Use Conventional Commits (for example `feat(auth): add oauth screen` or `fix(orders): correct pagination`) and mention migration identifiers in commit bodies when schema changes occur. Pull requests need a concise summary, linked Jira issue, updated tests, and UI screenshots whenever the webapp shifts. Call out manual steps (migrations, env vars, or backfills) so reviewers can reproduce outcomes.

## Deployment Logging Policy
Only commit, push, and deploy when explicitly instructed with the command "deploy". Every deployment must be logged in [docs/DEPLOYMENT_LOG.md](docs/DEPLOYMENT_LOG.md) using the same format as existing entries.

## Security & Configuration Tips
Never commit secrets; `.env.local` should hold placeholders only. Regenerate the Prisma client after each migration, and cast BigInt identifiers as `BigInt(Number(id))` in server responses to avoid JSON serialization issues. Surface any new configuration or operational follow-ups in PR descriptions to keep deploys predictable.
