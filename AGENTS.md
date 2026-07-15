# Repository Guidelines

## Documentation Policy
**Always update `AGENTS.md` when logic changes.** Any time domain logic, integration rules, architectural decisions, or key constraints are added or modified, the relevant section in this file must be updated in the same session. This file is the single source of truth for how the system works. New sections should follow the style of existing ones.

## AppShell Global Component Safety Rules
**CRITICAL**: AppShell (`app/app-shell.tsx`) is the parent wrapper for ALL pages. Any error in a component rendered here breaks the entire application silently on all pages.

### Prevention Rules
- **NEVER** add untested components directly to AppShell without local verification with `pnpm dev`
- **ALWAYS** test new AppShell changes locally on multiple routes before deploying
- **ALWAYS** wrap AppShell additions in error boundaries: `<ErrorBoundary fallback={null}><Component /></ErrorBoundary>`
- **ALWAYS** use lazy loading for optional features: `const Component = dynamic(() => import(...), {ssr: false})`
- **NEVER** render components using authentication hooks (useSession, useRouter) directly in AppShell without handling hydration timing
- **ALWAYS** verify no console hydration errors: `Warning: useLayoutEffect does nothing on the server`
- **ALWAYS** test session loading with NextAuth (session may be undefined during initial load)

### Historical Issues (Pattern)
- Deployment #347: Feature added to AppShell broke all pages
- Deployment #351: FloatingAIButton (with useSession hook) added to AppShell broke all pages
- Root cause both times: Component errors in AppShell propagate globally, breaking entire app

### Solution
If a component needs to appear on all pages:
1. Create as client-only: `'use client'` directive
2. Wrap in error boundary in AppShell
3. Use dynamic import with {ssr: false}
4. Test locally on ≥3 different routes
5. Verify in browser console for hydration warnings
6. Only then add to AppShell

### Reference
See `/memories/repo/ui-breaking-pattern.md` for detailed debugging process.

## Project Structure & Module Organization
The workspace is a single Next.js 14 application (App Router) with co-located API routes. Pages and components live in `app/` with co-located hooks and styles. API routes are in `app/api/` (50+ route files). Shared Prisma schema and migrations sit in `prisma/`, reusable types in `types/`, shared utilities in `lib/` (auth, Prisma client, audit logging, Zod schemas). Python scripts for bank XML processing live at the project root. Vercel cron jobs handle scheduled tasks (BOG import, NBG rates, cash accruals) via `vercel.json`.

- Jobs CRUD now includes `selling_price` support in the Prisma schema, API handlers, and the Jobs table/form UI.

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

**Stage 4: Raw Table Flag Updates** (formerly: Consolidated Table Insertion - removed)
- Update `bog_gel_raw_*` table (Supabase) with processing flags
- Mark counteragent_processed, parsing_rule_processed, payment_id_processed
- Set is_processed=TRUE when all three phases complete
- **Note**: consolidated_bank_accounts table has been **removed** (2026-06-06)
  - Raw bank account tables are now the **only** data source
  - No consolidation step needed - raw tables are queried directly

**Stage 5: (Deprecated)** - No longer applicable

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

## Bank Transactions Data Architecture

**PRIMARY DATA SOURCE**: Raw bank account tables (e.g., `GE65TB7856036050100002_TBC_GEL`, `GE78BG0000000893486000_BOG_GEL`, etc.) are the **active** source of truth for all bank transactions.

**REMOVED TABLE**: `consolidated_bank_accounts` was **permanently removed** from Supabase on 2026-06-06. This table is obsolete and no longer exists in the database schema or codebase.

### API Data Flow
- `/api/bank-transactions` queries raw tables via UNION across all bank accounts (see `SOURCE_TABLES` in route.ts)
- Each raw table has a unique offset to generate synthetic IDs
- Returns `raw_record_uuid` from the source raw table
- Batch transactions are resolved from `bank_transaction_batches` table

### Job Distribution Linkage
- `payments_jobs` table links distributions to bank transactions via `raw_record_uuid` or `batch_partition_uuid`
- `raw_record_uuid` references the UUID from raw bank account tables (NOT consolidated_bank_accounts)
- When verifying distribution integrity, always check raw tables (e.g., `GE65TB7856036050100002_TBC_GEL`) not consolidated table
- The `/api/payments-jobs/auto-distribute` endpoint receives `raw_record_uuid` from bank transaction UI and stores it in `payments_jobs` records

### Investigation Guidelines
- **NEVER** search `consolidated_bank_accounts` to verify `raw_record_uuid` references
- **ALWAYS** search the specific raw table (e.g., `GE65TB7856036050100002_TBC_GEL`) or use `/api/bank-transactions`
- Check `app/api/bank-transactions/route.ts` for the list of active source tables
- Each bank account has its own table with naming pattern: `{IBAN}_{BANK}_{CURRENCY}`

### Transaction-Payment Sync (PATCH and Bulk-Bind)
When a payment is assigned to a bank transaction via `PATCH /api/bank-transactions/[id]` or `PATCH /api/bank-transactions/bulk-bind`:
- **Automatic sync from payment:**
  - `nominal_currency_uuid` is set to the payment's `currency_uuid`
  - `exchange_rate` and `nominal_amount` are recalculated based on the new currency
  - **NEW (2026-06-10)**: `project_uuid` is synced from the payment's `project_uuid` (unless explicitly overridden in request)
  - **NEW (2026-06-10)**: `financial_code_uuid` is synced from the payment's `financial_code_uuid` (unless explicitly overridden in request)
  - `counteragent_uuid` is auto-assigned from payment if transaction has no counteragent yet
  - `parsing_lock` is set to `true` to prevent re-processing
- **When payment is cleared:**
  - All above fields are reset: `project_uuid`, `financial_code_uuid`, `nominal_currency_uuid` revert to defaults
  - `parsing_lock` is set to `false`
- **Rationale**: Handovers job distribution grid filters by `project_uuid` and income `financial_code_uuid`. Without this sync, manually editing a transaction with an existing payment would orphan it from the handovers view.

## Project Value Scaling
- When a project's `value` changes via the Projects API update routes, the system proportionally scales the related **auto-managed** `payments_ledger` rows (accrual + order) by `scaleFactor = newValue / oldValue`.
- Selection rules for payments to scale:
  - Always include `payments.is_project_derived = true` (main project payment) and `payments.is_bundle_payment = true` (bundle child payments).
  - Legacy fallback: also include payments for the project's financial code and its active bundle-child financial codes when they look auto-managed (`job_uuid IS NULL`, `income_tax = false`, `waybill_derived = false`).
- Only non-deleted, unconfirmed ledger rows are scaled by default; UI/API can optionally deconfirm first when explicitly requested.

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

### Insider Selection Persistence
- Selected insiders are persisted per user in `User.selected_insider_uuids` (`uuid[]`) and mirrored to the `insider-view-selection` cookie.
- Resolution precedence in `resolveInsiderSelection`: DB-persisted selection first, then cookie selection, then all available insiders as fallback.
- `POST /api/insider-selection` validates UUIDs against current insider options, stores the effective list in DB (when authenticated), and refreshes the cookie.
- This keeps insider-driven views (including Conversions and other insider-filtered APIs) stable across deployments even if browser cookie/domain context changes.

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

## Handovers Job Distribution UI & Emission
- The Job Distributions grid on Handovers renders bank-transaction-style rows (date, account, CA account, amount, nominal amount, financial code, nom ISO, payment ID, batch ID, description, ID1, ID2) from `/api/bank-transactions`, filtered by `project_uuid` and limited to payment IDs from income payments (`financialCodeIsIncome`).
- The Handovers jobs table shows calculated columns for Paid Nominal, Paid GEL, Debit Nominal, Debit GEL, and Total GEL, and its footer totals the numeric business columns that are actually displayed as totals (for example Floors and the money columns, but not Weight). Paid GEL is summed from `payments_jobs.amount_account_curr`, while Debit GEL/Total GEL are computed from nominal amounts using the job's `liftCertDate` and the project currency's NBG rate lookup by date.
- The grid supports advanced table features: column resizing (drag resize handle), column reordering (drag column headers), column visibility toggle (Columns dropdown), filtering (filterable columns have filter icon), sorting (sortable columns have sort icon), and global search (search bar filters all visible columns).
- Column configuration is persisted to localStorage (`handovers-job-distributions-columns`) including width, visibility, and user-dragged order; the restore path normalizes saved layouts without resetting the order on reload.
- The Job Distribution action appears only in the bank-transactions-style grid as a briefcase icon; the income payments grid does not show a distribution action.
- The distribution dialog supports only two modes: All (default) and Manual. All uses weighted distribution by job selling price and applies both nominal and account-currency amounts; Manual allows user edits.
- Manual mode includes a per-row Fill button that applies the bundle distribution percent for the payment's financial code to the job selling price, subtracts allocations already saved for the same `payment_uuid` (excluding the current raw/batch), and clamps to the remaining payment amount.
- Server-side distribution saves and auto-distribute/recalculate paths recompute account-currency amounts using bank transaction rates when stored values are missing or equal to nominal despite a non-1 rate.
- **Uniqueness**: `payments_jobs` uses partial unique indexes so distributions are unique per `batch_partition_uuid` (or `raw_record_uuid` when no batch); legacy rows with both NULL are limited to one per payment/job/project.
- Backfill script `scripts/backfill-payments-jobs-account-curr.js` recalculates historical `payments_jobs.amount_account_curr` using consolidated/raw bank amounts (prefers consolidated when present).
- The grid now provides an XLSX export action that flattens each payment into one row per job allocation so the exported amount and nominal amount reflect the distribution split.
- Export rows resolve distributions using the same composite key logic as the grid (batch partition or raw record UUID) so per-transaction allocations populate in Excel.
## Templates Management System

### Architecture Overview
The system now uses a dedicated `templates` table for managing XLSX templates for different operations (handover, invoice, certificate, etc.). Each operation must have exactly one active template.

**Key Features:**
- **Operation-based organization**: Templates are categorized by operation_type (handover, invoice, etc.)
- **One active per operation**: Database trigger enforces only one active template per operation_type
- **Archive on update**: When a new template is uploaded and activated, the old one is automatically archived
- **Supabase storage**: All templates stored in Supabase bucket `templates/`
- **Graceful fallback**: If database template unavailable, falls back to file system

### Database Schema
**Table: `templates`**
- `uuid`: Unique identifier for template
- `operation_type`: "handover", "invoice", "certificate", etc.
- `file_name`: Original filename (e.g., "Handover Tamplate New.xlsx")
- `storage_provider`: Always "supabase"
- `storage_bucket`: Defaults to "templates"
- `storage_path`: Path in Supabase bucket (e.g., `templates/handover/1719235200000-Handover.xlsx`)
- `file_size_bytes`: File size for UI display
- `file_hash_sha256`: Optional hash for integrity checking
- `is_active`: Boolean flag - only one TRUE per operation_type (enforced by DB trigger)
- `archived_at`: Timestamp when archived/deactivated
- `created_by_user_id`: User email who uploaded
- `created_at / updated_at`: Audit timestamps

**Indexes:**
- `(operation_type)` - List templates by operation
- `(is_active)` - Find active templates
- `(operation_type, is_active)` - Combined lookup for export routes
- `(created_at DESC)` - Timeline queries

**Database Trigger:**
```plpgsql
enforce_one_active_template_per_operation()
```
When `is_active = true` is set on any template, automatically deactivates all other templates for the same operation_type.

### Admin Interface
**Location:** `/admin/templates`

**Features:**
1. **Upload Form**
   - Select operation type (dropdown: handover, invoice, certificate)
   - Upload XLSX file
   - Checkbox: "Set as active" (optional - defaults to true)
   - Submit triggers immediate upload and activation if checked

2. **Templates List (grouped by operation)**
   - Shows all templates per operation
   - Indicates which is currently active (green badge)
   - Shows inactive (blue) and archived (gray) states
   - File size and upload timestamp
   - Action buttons: Activate (if inactive), Archive (if not archived)

3. **Status Indicators**
   - ✓ Active: Used by export routes
   - ⚠ No active: Cannot export (red warning)
   - Archived: Not used, kept for audit trail

### API Endpoints

**GET /api/templates?operationType=handover**
- List all templates, optionally filtered by operation_type
- Returns: `[{ uuid, operation_type, file_name, file_size_bytes, is_active, archived_at, created_at, created_by_user_id }]`

**POST /api/templates**
- Upload new template
- Body (multipart/form-data):
  - `operationType`: string (required)
  - `file`: File object (required)
  - `activate`: "true"|"false" (optional, defaults to true)
- Side effect: If `activate=true`, automatically archives existing active template for that operation
- Returns: `{ uuid, operation_type, file_name, file_size_bytes, is_active, created_at }`

**PATCH /api/templates/:uuid**
- Activate or deactivate template
- Body: `{ is_active: boolean }`
- If activating: Archives all other active templates for the same operation_type
- Returns: Updated template object

**DELETE /api/templates/:uuid**
- Archive a template (soft delete)
- Returns 400 if trying to delete the only active template for an operation
- Sets `is_active=false` and `archived_at=NOW()`
- Returns: `{ message, template: { uuid, operation_type } }`

### Export Route Integration

**File:** `app/api/export/handover-template/route.ts`

**Template Loading Priority:**
1. Query `templates` table for `operation_type = 'handover'` AND `is_active = true`
2. Fetch from Supabase storage using `storage_path`
3. If failed, fallback to file system `Handover Tamplate New.xlsx` from project root

**Logging:**
```
✓ Template loaded from templates table (Supabase), size: XXXXX
✓ Template loaded from file system, size: XXXXX
```

**Error Handling:**
- If no active template and file system fallback unavailable → HTTP 500
- Error message directs user: "Please upload a template via Admin > Templates..."

### Handover Template Sheet Structure
The handover template must contain these sheets:
1. **sheet1.xml (Handover sheet)** - Main document with Georgian form, 63 VLOOKUP formulas, 10 merged ranges, borders
2. **sheet2.xml (Placeholders sheet)** - Lookup table:
   - Column A (A1-A19): Label keys: "Project_Department", "Handover_Date", etc.
   - Column B (B1-B19): Values populated from database during export
3. **sheet3.xml (Jobs sheet)** - Template for job data table (populated during export)
4. Optional: Income Payments, Job Distributions sheets

### Placeholder Mapping (A1:B19)
Export populates B1-B19 with project data:
- A1: "Project_Department" → B1: project.department
- A2: "Handover_Date" → B2: project.date (Excel serial)
- A3-A19: Counteragent, insider, and project fields

### VLOOKUP Formula Pattern
Handover sheet formulas reference:
```excel
=VLOOKUP("Project_Department",Placeholders!A:B,2,FALSE)
```
Both columns A (labels) and B (values) must be populated for formulas to resolve.

### Handovers toolbar now supports both export modes: full template export (placeholders + all grids) and separate XLSX exports per table (Jobs, Income Payments, Job Distributions).
- The dialog resolves `payment_uuid` via `/api/payments-report` and preloads existing allocations from `/api/payments-jobs`.
- **Debugging**: Console logs track payment_uuid resolution (`[Job Dist]` prefix) including payment mapping, distribution loading, row payment lookup, and save operations. This helps diagnose cases where distributions might incorrectly appear across multiple payments.
- Runtime resilience guards for Handovers dependencies:
  - `GET /api/jobs?projectUuid=...` bypasses insider-selection resolution and returns project-bound jobs directly, so Handovers job loading is not blocked by insider-selection state.
  - In that project-scoped `/api/jobs` path, response mapping must not reference insider selection variables; use row fields directly (`insider_uuid`) to avoid runtime 500s from pre-declaration access.
  - `GET /api/brands` no longer selects optional/non-critical columns for Handovers bootstrap; this reduces schema-drift 500s on environments with lagging migrations.
  - `GET /api/payments-report` now falls back to a ledger-only query if the primary cross-table bank-union query fails, returning income rows instead of HTTP 500.
  - Handovers initial-load project mapping debug spam (`[Handovers] Mapping project`) was removed from the client component to keep production console noise low.

### Handover Emission Feature
When a user emits a handover, all current (non-emitted) job distributions are locked and marked with an `emission_uuid`, creating an immutable audit trail. Multiple emissions are supported, with the latest emission taking priority for display:
- **Emission Process**: User clicks "Emit Handover" button → API creates `handover_emissions` record → Updates all non-emitted `payments_jobs` with `emission_uuid` and `emission_date` → Returns emission details.
- **Multiple Emissions**: Same project can emit multiple times; each emission gets a unique UUID. After an emission, new distributions can be added and emitted again. All emissions are permanently recorded.
- **Display Priority**: UI shows emission status based on the most recent `emission_date` for the project. Historical emissions remain in the audit trail for reference.
- **Immutability**: Database triggers prevent UPDATE and DELETE on records with `emission_uuid IS NOT NULL`. Projects and jobs with emitted distributions cannot be deleted.
- **Live vs emitted rows**: emitted `payments_jobs` rows are immutable historical snapshots. Later distribution changes must operate only on live rows where `emission_uuid IS NULL`, allowing new non-emitted distributions to coexist with emitted snapshots for the same payment/job/scope.
- **API guard**: single-row delete/update attempts against an emitted distribution must fail, while replace/delete/auto-distribute/recalculate flows must only touch non-emitted rows (`emission_uuid IS NULL`) and leave emitted snapshots intact.
- **UI lock state**: the Job Distribution dialog opens in read-only mode (no save/clear/edit/fill/recalculate actions) when a transaction scope has only emitted snapshot rows and no live rows.
- **Schema**: New table `handover_emissions` (uuid, created_at, created_by, description). New columns on `payments_jobs`: `emission_uuid` (FK), `emission_date`.
- **API**: `POST /api/handovers/emit` accepts `{ projectUuid }`, returns emission UUID, timestamp, count, and list of emitted records. Only targets non-emitted distributions.
- **Audit Trail**: `emission_uuid` groups all records in a single emission; `created_by` records user email; `handover_emissions.created_at` records timestamp.
- **Future**: Emission history view, reversal capability (superuser only), bulk emission, notifications.

## Payments API - job_projects Auto-Binding

When a payment is created or updated with both `jobUuid` and `projectUuid`, the system automatically creates the corresponding `job_projects` binding if it doesn't already exist. This ensures jobs are properly associated with projects in the Handovers table without requiring separate API calls.

### Implementation
- **POST `/api/payments`**: After payment insertion, if both `jobUuid` and `projectUuid` are provided, automatically inserts `job_projects` binding with `ON CONFLICT DO NOTHING` (idempotent).
- **PATCH `/api/payments`**: After payment update, if both `nextJobUuid` and `nextProjectUuid` are set, automatically inserts `job_projects` binding with `ON CONFLICT DO NOTHING` (idempotent).
- **Failure Handling**: Binding errors are logged as warnings but do not block payment creation/update (binding is secondary to payment operation).
- **Side Effect**: Once created, jobs immediately appear in Handovers jobs table for that project (via `GET /api/jobs?projectUuid=X` which uses `INNER JOIN job_projects`).

### Rationale
Previously, payments could reference a `jobUuid` and `projectUuid` combination without the job being bound to that project in `job_projects`. This caused jobs to not render in Handovers even though they were allocated there. Now, the binding is automatically maintained whenever a payment references both.

## Global Date Normalization Rules (Ledger/Statement)

To prevent `NaN.NaN.NaN` date regressions across statements and ledger editing flows:

- **Canonical storage format**: `yyyy-mm-dd` (ISO date-only) for all `effective_date` payloads sent to API routes.
- **Display format**: `dd.mm.yyyy` only in UI text fields and rendered table cells.
- **Single normalization utility**: use `lib/date-normalization.ts` (`normalizeToIsoDate`, `toDisplayDate`, `toDateInputValue`, `toDateSortTimestamp`) instead of ad-hoc `new Date(...)` conversions.
- **API boundary validation**: `/api/payments-ledger`, `/api/payments-ledger/[id]`, and `/api/adjustments` must normalize inbound dates and return HTTP 400 on invalid date strings.
- **Local optimistic updates**: when updating in-memory ledger rows after edit, persist `effectiveDate` in ISO format (not `dd.mm.yyyy`) so downstream date formatters and sorters remain stable.

## Build, Test, and Development Commands
Install depeferencendencies once with `pnpm i`. Use `pnpm dev` to launch web, API, and workers concurrently while developing. Whenever `prisma/schema.prisma` changes, run `pnpm prisma migrate dev --name <feature>` followed by `pnpm prisma generate` to refresh the client. After adding new models to the schema, run `python scripts/auto-generate-templates.py` to automatically create Excel import templates in the `templates/` folder. Execute `pnpm test` for Jest coverage and `pnpm test:e2e` when end-to-end verification is required; append `--watch` for quick feedback loops.

## Coding Style & Naming Conventions
All code is TypeScript and must satisfy the shared ESLint + Prettier rules via `pnpm lint` or `pnpm lint --fix`. Name files in kebab-case (`user-profile.ts`), React components in PascalCase (`UserProfile.tsx`), and variables or functions in camelCase. Keep comments purposeful: explain non-obvious invariants, integration quirks, or domain rules.

## Handovers Export & Loading Optimization (2026-06-11)
The Handovers page implements a multi-stage loading pipeline with export caching to optimize performance and prevent premature export attempts.

### Loading States & Coordination
Three independent loading flags coordinate when export is ready:
- **`loadingProjects`**: Initial fetch of projects, brands, insiders (runs once on mount)
- **`loadingJobs`**: Per-project fetch of jobs, lift cert dates, bank transactions, income payments, distributions
- **`ratesLoading`**: NBG rate lookups for each unique lift cert date (runs after jobs load)

**Computed Flag**: `isTableFullyLoaded = !loadingProjects && !loadingJobs && !ratesLoading && selectedProjectUuid !== ''`

**Export Button Disabled When**: `!isTableFullyLoaded || sortedJobs.length === 0`
- Prevents export before Debit GEL and Total GEL columns are populated (which require NBG rates)
- Dynamic tooltip shows "Loading all tables including rates..." when disabled
- Button enables only after all async operations complete

### Export Data Cache Structure
When jobs fully load and rates are fetched, `exportCache` state is populated:
```typescript
{
  projectUuid: string | null,           // Selected project UUID
  projectData: {                         // Project metadata
    projectName: string,
    currencyCode: string,
    liftCertMap: Record<string, { date, docNo }>
  },
  jobsData: any[],                      // Raw job records from /api/jobs
  paymentsData: any[],                  // Income payments from /api/payments-report
  distributionsData: any[],             // Job distributions from /api/payments-jobs
  rateCache: Map<string, number | null>, // NBG rates keyed by date|currency
  timestamp: number                      // Cache creation timestamp
}
```

**Cache Population**: Occurs in `fetchJobs` after:
1. Lift cert info fetched and mapped
2. Payments and distributions processed
3. NBG rates batch-fetched and stored in `rateByDate`
4. Before `setJobs()` updates jobs state with calculated Debit GEL/Total GEL

**Cache Usage**: Prepared for export API to use cached data instead of re-querying database when `useCache=true` flag passed (future optimization).

### Rate Fetching Sequence
1. Extract unique cert dates from jobs: `Set<string>`
2. Call `Promise.all()` on `uniqueCertDates.map(date => lookupNbgRate(date, projectCurrencyCode))`
3. `lookupNbgRate` caches per `date|currency` key in `rateCacheRef`
4. Return rates in `rateByDate` Map
5. Used in job rendering: `debitGel = (sellingPrice - paidNominal) * rate`, `totalGel = paidGel + debitGel`

**Caching Strategy**:
- `rateCacheRef` persists across renders (useRef)
- Failed rate lookups cached as `null` to prevent retries
- GEL→GEL conversions return `1` immediately
- Deduplicates identical date+currency requests within same fetch cycle

### Debit GEL and Total GEL Column Dependency
These computed columns **depend on NBG rates** and return `null` until rates are available:
- **Debit GEL**: `(sellingPrice - paidNominal) * rate`
- **Total GEL**: `paidGel + debitGel`

If `rate` is `undefined` (still loading) or `null` (fetch failed), columns show `—` placeholder. Export button stays disabled until all rows have valid calculations.

## Testing Guidelines
Favor tests on public contracts: API handlers, Prisma services, and UI state reducers. Co-locate Jest specs as `*.test.ts(x)` near their source or under `tests/`, and refresh fixtures in `tests/fixtures/` when behavior shifts. Capture cross-surface flows, including auth, with Playwright specs; start `pnpm dev` before launching them to ensure all services are available.

## Commit & Pull Request Guidelines
Use Conventional Commits (for example `feat(auth): add oauth screen` or `fix(orders): correct pagination`) and mention migration identifiers in commit bodies when schema changes occur. Pull requests need a concise summary, linked Jira issue, updated tests, and UI screenshots whenever the webapp shifts. Call out manual steps (migrations, env vars, or backfills) so reviewers can reproduce outcomes.

## Deploying Instructions
Only run deployment when explicitly asked with the command `deploy`.

Build locally before any deployment. A successful local production build is mandatory before you push or deploy.

Use this exact procedure for every production release:
1. Verify the change set locally with the project checks that apply (`pnpm exec tsc --noEmit --pretty false`, `pnpm lint`, and `pnpm build`).
2. Commit the implementation changes with a Conventional Commit message.
3. Push the commit with `"[skip ci]"` in the commit message so Vercel Git auto-deploy does not run.
4. Run exactly one manual production deploy with `npx vercel --prod --yes`.
5. Record the production URL and commit reference in [docs/DEPLOYMENT_LOG.md](docs/DEPLOYMENT_LOG.md).
6. Commit and push the deployment-log update with `"[skip ci]"` in the commit message.

This keeps production deploys single-shot, traceable, and free of duplicate Vercel builds.

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
