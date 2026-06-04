# Repository Guidelines

## Documentation Policy
**Always update `AGENTS.md` when logic changes.** Any time domain logic, integration rules, architectural decisions, or key constraints are added or modified, the relevant section in this file must be updated in the same session. This file is the single source of truth for how the system works. New sections should follow the style of existing ones.

## Project Structure & Module Organization
The workspace is a single Next.js 14 application (App Router) with co-located API routes. Pages and components live in `app/` with co-located hooks and styles. API routes are in `app/api/` (50+ route files). Shared Prisma schema and migrations sit in `prisma/`, reusable types in `types/`, shared utilities in `lib/` (auth, Prisma client, audit logging, Zod schemas). Python scripts for bank XML processing live at the project root. Vercel cron jobs handle scheduled tasks (BOG import, NBG rates, cash accruals) via `vercel.json`.

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
4. **Single-batch rule:** one raw transaction (`raw_record_uuid`) can belong to **only one** batch ID. Creating a second batch for the same raw transaction is invalid and must be blocked in UI and at the database level.
5. **Minimum partitions rule:** a batch must contain **at least 2 partitions**. Single-partition batches are invalid and must be blocked in UI and at the database level.
6. **Raw BTC guard (DB trigger):** raw tables cannot set `payment_id` to `BTC_%` unless the batch has **≥2 partitions** for the same `raw_record_uuid` (deferrable constraint trigger).
7. **Batch delete cleanup (DB trigger):** when the last partition for a `batch_id` is deleted, the raw tables clear `payment_id` and `parsing_lock` for the linked `raw_record_uuid`.
8. **API/UI validation:** batch creation requires at least 2 partitions; UI blocks save and API returns 400 when `partitions.length < 2`.

### Fully Processed Definition
A record is considered fully processed when ALL three flags are TRUE:
- `counteragent_processed=TRUE`
- `parsing_rule_processed=TRUE`
- `payment_id_processed=TRUE`

Or equivalently: `is_processed=TRUE` (derived from all three flags)

### Correction Date Rules
- `correction_date` must never equal `transaction_date`. UI clears same-day values and the database enforces this via triggers.

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

## Bank Transactions API Filters
- `GET /api/bank-transactions` supports `project_uuid` or `projectUuid` for server-side filtering. Conversion entries are filtered by `project_uuid`, and balance records are omitted when a project filter is set.

## RS.ge Waybill Sync

### Architecture Overview
Buyer waybills are fetched from the RS.ge SOAP API (`WaybillService.asmx`) and written to a single table:
- **`rs_waybills_in_api`** — single source of truth; user-editable fields (project, financial code, corresponding account) start NULL and are set exclusively via UI, never overwritten by sync.

The legacy `rs_waybills_in` table is no longer written to by any code path.

### Multi-Insider Credential Map
All RS.ge credentials are stored in `RS_CREDENTIALS_MAP` (JSON array in `.env.local` and Vercel env):
```json
[{"INSIDER_UUID":"...","RS_API_SU":"iceapi:XXXXXXXXX","RS_API_SP":"..."}]
```
Add one object per insider/company. Parsed by `getRsCredentialsMap()` in `lib/integrations/rsge/client.ts`. Both cron routes and the manual sync endpoint read exclusively from this map — there are no separate `RS_API_SU`/`RS_API_SP` fallback vars.

### VAT Lock Rule
`vat` (counteragent VAT payer status) is a **point-in-time snapshot** captured at first import via `is_vat_payer_tin` SOAP call:
- **CREATE**: `vat` is stored from the live API response.
- **UPDATE**: `vat` is explicitly excluded from all update payloads — the original value is preserved forever.
- This applies to `rs_waybills_in_api`.

### Date Filter
The API filter used is `create_date_s / create_date_e` (matches the portal's **Activation Period** filter). `begin_date_s/e` (transport start date) is NOT used — it returns `-1064` when no waybills have a BEGIN_DATE in range.

### Scheduled Cron Jobs (vercel.json)
| Route | Schedule (UTC) | Tbilisi equivalent | Purpose |
|---|---|---|---|
| `/api/cron/waybills-today` | `0 4-16 * * *` | Hourly 08:00–20:00 | Sync today's waybills + items for all insiders (maxDuration 120 s) |
| `/api/cron/waybills-quarterly` | `0 0 * * *` | 04:00 daily | Re-sync last 3 months waybills + items, catch corrections (maxDuration 600 s) |

Both routes loop over every entry in `RS_CREDENTIALS_MAP`, call `runWaybillSync` then `runWaybillItemsSync` per insider, and return aggregated totals + per-insider breakdown. Individual insider errors are caught and surfaced without aborting the loop.

### Shared Sync Library
`lib/waybills/run-waybill-sync.ts` — exported `runWaybillSync(credentials, dateFrom, dateTo, options?)`:
- `options.insiderUuid` — if provided, used directly; otherwise falls back to `getRequiredInsider()` (used by the manual sync route for backward compat).
- `options.statuses`, `options.itypes` — passed through to the SOAP call.
- Returns `{ imported, updated, sync_batch_id, message? }`.

`lib/waybills/run-waybill-items-sync.ts` — exported `runWaybillItemsSync(credentials, dateFrom, dateTo, options)`:
- `options.insiderUuid` — required; items are scoped to this insider.
- Calls `getBuyerWaybillGoodsList` (same date range as waybill sync); batches by month when range spans multiple months.
- Skips waybills that already have items in `rs_waybills_in_items` to preserve user-assigned fields (`project_uuid`, `financial_code_uuid`, `corresponding_account`).
- Must be called **after** `runWaybillSync` so waybill records already exist in `rs_waybills_in_api`.
- Returns `{ items_inserted, items_skipped, items_errors }`.

### Manual Sync Endpoint
`POST /api/waybills/sync` — accepts `{ begin_date?, end_date?, statuses?, itypes?, raw? }`:
- Uses the **first** entry in `RS_CREDENTIALS_MAP` (no `insiderUuid` passed → falls back to `getRequiredInsider()`).
- `raw: true` mode fetches and parses XML without writing to DB (field inspection).
- Default date range: last 30 days.

### Data Gaps & Known Constraints
- Waybills with `create_date = null` in RS.ge are **invisible** to the `create_date_s/e` filter. Such records must be inserted manually via the CSV import route (`/api/waybills/import`), which only accepts records with a non-null `rs_id`.
- `rs_waybills_in_api` is unique on `rs_id` (non-nullable). The legacy `rs_waybills_in` table still exists in the DB but is no longer used.

### Unit Handling (Official RS.ge unit IDs)
The official unit list is fetched via `get_waybill_units` SOAP method. Verified IDs (only 14 exist):
```
1=ც(ცალი)  2=კგ  3=გ(გრამი)  4=ლ(ლიტრი)  5=ტ(ტონა)
7=სმ(სანტიმეტრი)  8=მ(მეტრი)  9=კმ(კილომეტრი)
10=კვ.სმ  11=კვ.მ  12=მ³  13=მლ(მილილიტრი)  14=შეკვ(შეკვრა)  99=სხვ(custom)
```
- **ID=99 = სხვა (custom)**: `UNIT_TXT` in `get_waybill` response is the actual unit name. The bulk method `get_buyer_waybilll_goods_list` does **NOT** return `UNIT_TXT` — only `UNIT_ID`.
- **Backfill endpoint**: `POST /api/waybills/backfill-unit-txt` calls `get_waybill(rs_id)` for waybills with unit_id=99 items and updates the `unit` column with the real UNIT_TXT. Supports `?limit=N&offset=N&dry_run=true`.
- **SOAP functions in `lib/integrations/rsge/client.ts`**:
  - `getBuyerWaybillsXml` → `get_buyer_waybills` (documented, returns waybill list incl. IS_CONFIRMED)
  - `getBuyerWaybillGoodsList` → `get_buyer_waybilll_goods_list` (undocumented bulk, no UNIT_TXT)
  - `getWaybill(su, sp, waybillId)` → `get_waybill` (per-waybill with full goods + UNIT_TXT)
  - `batchIsVatPayerTin` → `is_vat_payer_tin`
- **IDs that do NOT exist** in the official list: 6, 15, 16, 17, 18, 19. Any items or dimension-map entries with these phantom IDs are data errors from a previously incorrect hardcoded map.

## Waybill-Derived Payments

When a waybill is bound (or re-bound) to a project, the system automatically creates and maintains a corresponding `payments` record and a `payments_ledger` entry.

### Key Rules
- **Trigger**: Any `PATCH /api/waybills?id=...` or `PATCH /api/waybills/bulk` that changes `project_uuid` or `counteragent_uuid` calls `syncWaybillPayment` in `lib/waybills/sync-waybill-payment.ts`.
- **Payment grouping**: One `payments` record per unique `(counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid)` combination. The first waybill in a group creates a payment with ID `WB-{rs_id}`; subsequent waybills reuse the existing group payment. This avoids N duplicate payments for the same supplier/project.
- **Ledger entries**: One `payments_ledger` entry per waybill (matched by `comment = 'Waybill: {waybill_no}'`). When a waybill's project changes, the old ledger entry is deleted and a fresh one is inserted under the new group payment.
- **Currency**: always GEL (looked up by `code = 'GEL'`).
- **Financial code**: cost FC derived via `project.financial_code_uuid → financial_codes.default_code_fc`; falls back to FC `3.9.4` when project is unset or the FC has no `default_code_fc`.
- **Return waybills**: when `type = 'უკან დაბრუნება'`, the amount is negated.
- **`waybill_derived = true`** on the `payments` row marks it as auto-managed.
- **Read-only guard**: `POST` and `DELETE` on `/api/payments-ledger` return HTTP 403 for `waybill_derived` payments. The UI replaces the delete button with a "WB" badge for these entries.

### DB Constraint Changes
- **Composite unique → partial index**: The original `@@unique([project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid])` constraint on `payments` was replaced with a partial unique index `payments_composite_unique_non_waybill` (`WHERE waybill_derived = FALSE`) via `_apply_waybill_payments_constraint.js`. This allows multiple waybill-derived payments to share the same composite key while still enforcing uniqueness for manual payments.
- **payment_id format constraint expanded**: `payments_payment_id_format_check` originally only allowed `^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$` (hex format). Updated via `_fix_payment_id_constraint.js` to also allow `^WB-[0-9]+$` for waybill-derived payments.
- **Zero-sum waybills**: When a waybill has `sum = NULL` or `sum = 0`, the payment record is still created but no ledger entry is inserted (the `check_accrual_or_order` constraint on `payments_ledger` requires non-null, non-zero accrual/order).

### Open Issue — Item-Level Priority
When waybill items are bound to different projects, item-level binding should take priority over waybill-level payment derivation. This is not yet implemented; the current implementation operates at the waybill level only.

## Handovers Job Distribution UI
- The Job Distributions grid on Handovers renders bank-transaction-style rows (date, account, CA account, amount, nominal amount, financial code, nom ISO, payment ID, batch ID, description, ID1, ID2) from `/api/bank-transactions`, filtered by `project_uuid` and limited to payment IDs from income payments (`financialCodeIsIncome`).
- The grid supports advanced table features: column resizing (drag resize handle), column reordering (drag column headers), column visibility toggle (Columns dropdown), filtering (filterable columns have filter icon), sorting (sortable columns have sort icon), and global search (search bar filters all visible columns).
- Column configuration is persisted to localStorage (`handovers-job-distributions-columns`) including width, visibility, and user-dragged order; the restore path normalizes saved layouts without resetting the order on reload.
- The Job Distribution action appears only in the bank-transactions-style grid as a briefcase icon; the income payments grid does not show a distribution action.
- The distribution dialog supports only two modes: All (default) and Manual. All uses weighted distribution by job selling price and applies both nominal and account-currency amounts; Manual allows user edits.
- The dialog resolves `payment_uuid` via `/api/payments-report` and preloads existing allocations from `/api/payments-jobs`.
- **Debugging**: Console logs track payment_uuid resolution (`[Job Dist]` prefix) including payment mapping, distribution loading, row payment lookup, and save operations. This helps diagnose cases where distributions might incorrectly appear across multiple payments.

## Build, Test, and Development Commands
Install depeferencendencies once with `pnpm i`. Use `pnpm dev` to launch web, API, and workers concurrently while developing. Whenever `prisma/schema.prisma` changes, run `pnpm prisma migrate dev --name <feature>` followed by `pnpm prisma generate` to refresh the client. After adding new models to the schema, run `python scripts/auto-generate-templates.py` to automatically create Excel import templates in the `templates/` folder. Execute `pnpm test` for Jest coverage and `pnpm test:e2e` when end-to-end verification is required; append `--watch` for quick feedback loops.

## Coding Style & Naming Conventions
All code is TypeScript and must satisfy the shared ESLint + Prettier rules via `pnpm lint` or `pnpm lint --fix`. Name files in kebab-case (`user-profile.ts`), React components in PascalCase (`UserProfile.tsx`), and variables or functions in camelCase. Keep comments purposeful: explain non-obvious invariants, integration quirks, or domain rules.

## Testing Guidelines
Favor tests on public contracts: API handlers, Prisma services, and UI state reducers. Co-locate Jest specs as `*.test.ts(x)` near their source or under `tests/`, and refresh fixtures in `tests/fixtures/` when behavior shifts. Capture cross-surface flows, including auth, with Playwright specs; start `pnpm dev` before launching them to ensure all services are available.

## Commit & Pull Request Guidelines
Use Conventional Commits (for example `feat(auth): add oauth screen` or `fix(orders): correct pagination`) and mention migration identifiers in commit bodies when schema changes occur. Pull requests need a concise summary, linked Jira issue, updated tests, and UI screenshots whenever the webapp shifts. Call out manual steps (migrations, env vars, or backfills) so reviewers can reproduce outcomes.

## Deployment Logging Policy
Only commit, push, and deploy when explicitly instructed with the command "deploy".

For every deployment, use this **single-production-deploy** procedure to avoid extra Vercel builds:
1. Run local production build.
2. Commit code changes.
3. Push code commit with `"[skip ci]"` in the commit message (or equivalent) so Vercel Git auto-deploy does not run.
4. Run exactly one manual production deploy (`npx vercel --prod --yes`).
5. Add deployment entry to [docs/DEPLOYMENT_LOG.md](docs/DEPLOYMENT_LOG.md) with commit and production URL.
6. Commit and push the log update with `"[skip ci]"` in the commit message.

This guarantees one production deployment per requested release while still preserving deployment history in git.

## Security & Configuration Tips
Never commit secrets; `.env.local` should hold placeholders only. Regenerate the Prisma client after each migration, and cast BigInt identifiers as `BigInt(Number(id))` in server responses to avoid JSON serialization issues. Surface any new configuration or operational follow-ups in PR descriptions to keep deploys predictable.
