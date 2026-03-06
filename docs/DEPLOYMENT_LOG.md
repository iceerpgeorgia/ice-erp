# Deployment Log

## 2026-03-06 (7)
- Summary: Fix missing salary period payment in All Payments report and prevent invisible active filters in Projects table.
- Changes:
  - Salary report API (`/api/salary-report`): missing-period projected rows now prefer real bank `payment_id` values per period instead of only generated IDs.
  - Salary report API (All Payments mode): payment inclusion now also accepts PRL salary-like payment IDs from bank data when accrual and bank IDs differ.
  - Projects table: when any filter is active on a hidden column (e.g. `projectUuid`), that column is auto-shown so filters are visible and removable.
  - Result: March salary payments (e.g. for ლაშა ვერულიძე) appear in All Payments view; Projects page no longer looks unfiltered while silently filtered.
- Commit: f2139f5
- URL: https://ice-ksn8qn14z-iceerp.vercel.app

## 2026-03-06 (6)
- Summary: Salary report All Payments PDF export now fits all columns (including cumulative columns) using compact print layout and auto width.
- Changes:
  - Salary report page (`/salary-report/[counteragentUuid]`): Added print-specific CSS for All Payments table.
  - PDF print page set to landscape with reduced margins for wider usable area.
  - All Payments print table now uses `table-layout: auto` with compact font and reduced cell padding.
  - Print cell sizing now minimizes column widths to content length to keep cumulative columns visible in exported PDF.
- Commit: 442f8c9
- URL: https://ice-hpgb82980-iceerp.vercel.app

## 2026-03-06 (5)
- Summary: Salary report projected rows now keep only payment-side effect on balances (no copied accrual amounts).
- Changes:
  - Salary report API (`/api/salary-report`): projected rows for missing paid periods now clear copied accrual data and keep payment linkage only.
  - For projected rows, set `net_sum = 0` and clear insurance/deduction fields (`surplus_insurance`, `deducted_insurance`, `deducted_fitness`, `deducted_fine`).
  - Result: employee advances are visible in cumulative balance without artificial projected accrual amounts.
- Commit: 25acf28
- URL: https://ice-jdsrpaqb9-iceerp.vercel.app

## 2026-03-06 (4)
- Summary: Salary report/UI date normalization and full-width layout; auto-projected salary accrual periods from paid bank transactions.
- Changes:
  - Salary report (All Payments): Date display normalized to `MMM YYYY` in table and XLSX export.
  - Salary report layout: Removed max-width container so report stretches full screen width.
  - Salary report API (`/api/salary-report`): Added missing-period detection from paid PRL payment IDs and auto-generated projected accrual rows by cloning latest accrual for periods with payments but no accrual record.
  - Salary report API: Preserved projected row metadata in both `mode=total` and `mode=all` outputs.
  - Salary accruals API (`/api/salary-accruals`): Added same projected accrual generation logic per counteragent for paid-but-missing periods.
  - Salary accruals table: Added projected row styling (amber + italic) and `projected` field support.
- Commit: 19368e5
- URL: https://ice-82gxc711s-iceerp.vercel.app

## 2026-03-06 (3)
- Summary: Salary report dual-mode: Total Payments (by period) and All Payments (by actual transaction date).
- Changes:
  - Salary report now has two tabs: "Total Payments" (aggregated by salary period) and "All Payments" (chronological ledger with individual bank transactions).
  - All Payments mode: interleaves accrual entries (blue badges) and individual payment transactions (green badges) sorted by actual transaction_date from bank records.
  - API /api/salary-report supports `mode=total` (default) and `mode=all` query param. All mode fetches individual payment rows from all 10 deconsolidated tables with actual dates.
  - Running cumulative accrual/payment/balance in both views.
  - XLSX export adapted per mode (separate sheet names and column layouts).
- Commit: 0479163
- URL: https://ice-n3uzxv9mw-iceerp.vercel.app

## 2026-03-06 (2)
- Summary: Salary report per counteragent with XLSX/PDF export; bank import PGRST205 error handling fix.
- Changes:
  - New salary report page (/salary-report/[counteragentUuid]): Opens in new tab per counteragent with header showing counteragent details (name, ID, sex, pension scheme, IBAN, currency).
  - Report table columns: Period, Payment ID, Net Sum (adjusted by pension_scheme ×0.98), Surplus Insurance, Ded. Insurance, Ded. Fitness, Ded. Fine, Payment, Month Balance, Cumulative Accrual, Cumulative Payment, Cumulative Balance.
  - Totals row with color-coded balances (red=unpaid, green=overpaid).
  - Export XLSX button (full report with header info + data table using xlsx library).
  - Export PDF button (via window.print() with print-friendly CSS).
  - New API endpoint /api/salary-report: Calculates paid amounts across all 10 deconsolidated tables including batch resolution, pension scheme adjustment, and cumulatives.
  - New BarChart3 (purple) icon in salary accruals row actions to open salary report in new tab. Actions column widened to 180px.
  - Page title registered for /salary-report route.
  - Bank XML import (deconsolidated): Added PGRST205 error handling — gracefully skips missing Supabase tables instead of failing.
  - DB cleanup: Deleted orphan bank account GE43BG0000000609494201 (no raw table, no parsing scheme).
  - DB fix: 20 nominal amount records fixed for counteragent სიჩკენდერ (GEL→USD conversion using NBG rates).
- Commit: 3bdfe1d
- URL: https://ice-e5wxehilg-iceerp.vercel.app

## 2026-03-06 (1)
- Summary: Copy salary accrual to months feature; NBG rate missing warning; pending→completed multi-entry detection fix.
- Changes:
  - Salary accruals: New per-row "Copy to months" action (green Copy icon). Opens dialog showing source details and checkboxes for ±36-month range. Existing months shown disabled/strikethrough. Records created on last day of selected month with new payment_id. deducted_insurance set to null on copy.
  - Bank import (deconsolidated): NBG exchange rate missing dates now tracked and reported in FINAL SUMMARY warning.
  - Bank import (deconsolidated): Pending→completed detection rewritten to handle multi-entry DocKeys (e.g. TRN+COM). Now stores all entries per DocKey and matches by date+amount per entry instead of keeping only max EntriesId.
  - Bank import (consolidated, bog-gel-processor): calculateNominalAmount updated with optional missingRateDates parameter for rate tracking.
  - Python import script: Added pending→completed detection and cleanup-pending-duplicates mode.
  - Added check-duplicates.js and cleanup-duplicates.js utility scripts.
- Commit: d3fd1d5
- URL: https://ice-2lws621br-iceerp.vercel.app

## 2026-03-05 (6)
- Summary: Batch editor two-way nominal/account amount calculation for salary entries; projected salary IDs now generated for all 153 counteragents (was only 5).
- Changes:
  - Batch editor: Two-way calculation between partition amount (GEL) and nominal amount (e.g. USD) now works for salary accrual payment IDs (previously blocked because salary entries have no paymentUuid).
  - Batch editor: Nominal input enabled for salary payment IDs (was disabled).
  - Batch editor: Exchange rate recalculation on load also applies to salary payment ID partitions.
  - Payment ID options API: Projected salary IDs now generated per-counteragent from each one's latest salary_month, instead of only from the global MAX(salary_month). Fixed 148/153 counteragents missing from projections.
- Commit: 0b0828d

## 2026-03-05 (5)
- Summary: Fix self.ge "Add to Salary" using counteragent's existing currency instead of hardcoded GEL; fix balance>0 filter floating-point threshold.
- Changes:
  - Self.ge dialog: "Add to Salary" now looks up the counteragent's existing salary accruals currency (e.g. USD) instead of always defaulting to GEL.
  - Salary accruals: "Confirmed & Balance>0" filter uses `>= 0.01` threshold to properly exclude near-zero floating-point values that display as `0.00`.
  - DB fix: Updated 2 payment records for counteragent აბდულ ჰამეედ სიჩკენდერ from GEL to USD (payment IDs: 63810f_23_9be30c, 6f15fe_50_864951).
- Commit: e29367b

## 2026-03-05 (4)
- Summary: Self.ge "Add to Salary" opens prefilled Add Accrual dialog; row removed from missing list on save; balance>0 filter fix.
- Changes:
  - Self.ge dialog: "Add to Salary" button now opens the standard Add Accrual dialog prefilled with counteragent, salary month (last day of month), net sum, and GEL currency.
  - Self.ge dialog: After saving, the row is immediately removed from the "Missing In Salary Accruals" list.
  - Self.ge dialog: Counteragent IBAN update preserved after save.
  - Salary accruals: "Confirmed & Balance>0" condition filter now rounds cumulative balance to 2 decimal places to exclude floating-point near-zero values.
- Commit: a38b000
- URL: https://ice-d9xq1sfds-iceerp.vercel.app

## 2026-03-05 (3)
- Summary: Strict pending-to-completed detection in bank XML import; per-row financial code in self.ge dialog using main accruals API.
- Changes:
  - Bank XML import (deconsolidated): Pending-to-completed detection now requires same DocKey + same date + same amount + different EntriesId (previously only checked DocKey/EntriesId).
  - Bank XML import: Detailed log output for each pending-to-completed match showing old/new IDs, counteragent, date, amount.
  - Self.ge dialog: Per-row financial code selector replaces shared header-level combobox; each row requires its own financial code selection.
  - Self.ge dialog: Now uses main `/api/salary-accruals` POST endpoint (auto-generates payment_id via `generatePaymentId()`) instead of self.ge-specific `add-to-salary` action.
  - Self.ge dialog: IBAN update preserved via separate counteragent PUT call after accrual creation.
- Commit: f0f5653
- URL: https://ice-d9xq1sfds-iceerp.vercel.app

## 2026-03-05 (2)
- Summary: Require financial code selection before adding missing records to salary from self.ge dialog.
- Changes:
  - Salary accruals table: Added Financial Code combobox to "Missing In Salary Accruals" section; user must select a financial code before clicking "Add to Salary".
  - upload-self-ge API: `add-to-salary` action now requires `financial_code_uuid` parameter; removed auto-defaulting to first financial code.
- Commit: f78768f
- URL: https://ice-d9xq1sfds-iceerp.vercel.app

## 2026-03-05
- Summary: Self.ge upload dialog enhancements: IBAN parsing, net=salary×80%, per-row add counteragent/salary buttons, comma-separated salary handling.
- Changes:
  - upload-self-ge API: Parse IBAN from `ანგარიშის ნომერი` column; net sum calculated as `ხელფასი × 0.8`; comma-separated salary values (e.g. "2000,5000") use rightmost number; IBAN included in all comparison result categories.
  - New API actions: `create-single-counteragent` (with IBAN), `add-to-salary` (creates accrual + syncs IBAN on counteragent if different). Bulk create also saves IBAN.
  - Salary accruals table: Missing Counteragents section shows IBAN column and per-row "Add" button; after adding, row moves locally to Missing In Salary section. Missing In Salary section shows IBAN column and per-row "Add to Salary" button. Bulk "Add All" also moves rows locally.
  - Types updated: `SelfGeCounteragentRow` and `SelfGeMissingSalaryRow` include optional `iban` field.
- Commit: e8e1fba
- URL: https://ice-ngge7zqdp-iceerp.vercel.app

## 2026-03-06 (2)
- Summary: Red unbound icon in salary accruals, UUID-based counteragent filter, job/counteragent skip buttons with URL param handling.
- Changes:
  - Salary accruals API: Added unbound counteragent transaction query; each row now includes `hasUnboundCounteragentTransactions` flag.
  - Salary accruals table: User icon turns red when counteragent has unbound transactions; added ArrowUpRight + Filter buttons to counteragent_name column; added `?counteragentUuid=` URL param handling on load.
  - Payments report table: Filter button now uses `counteragentUuid` (UUID) instead of counteragent name; URL param updated to `?counteragentUuid=`; path corrected to `/dictionaries/payments-report`; added ArrowUpRight skip button on job column linking to `/dictionaries/jobs?jobUuid=`.
  - Jobs table: Added `?jobUuid=` URL param handling on load to apply facet filter.
- Commit: 026b0c2
- URL: https://ice-eb02frngv-iceerp.vercel.app

## 2026-03-06
- Summary: Payments report counteragent buttons + URL param filter support.
- Changes:
  - Counteragent column: Added ArrowUpRight button linking to `/counteragent-statement/{uuid}` and Filter button linking to `/admin/payments-report?counteragent={name}` (new tab).
  - Actions column: Added User icon button linking to counteragent statement.
  - URL param handling: On load, reads `?counteragent=X` from URL and applies it as a facet filter on the counteragent column, overriding any saved localStorage filter for that column.
- Commit: cc3077f
- URL: https://ice-r8kqjo353-iceerp.vercel.app

## 2026-03-05 (3)
- Summary: Add columnFormat to statement pages for full shared filter parity (numeric/date/text/boolean condition tabs).
- Changes:
  - Both pages: Added `format?: ColumnFormat` to `ColumnConfig` type.
  - Counteragent statement: `date` → `'date'`, `incomeTax`/`confirmed` → `'boolean'`, `accrual`/`order`/`payment`/`ppc` → `'currency'`, `comment` → `'text'`; pass `columnFormat={col.format}` to `ColumnFilterPopover`.
  - Payment statement: `date`/`createdAt` → `'date'`, `confirmed` → `'boolean'`, `accrual`/`payment`/`order`/`ppc`/`due`/`balance` → `'currency'`, `paidPercent` → `'percent'`, `comment` → `'text'`; pass `columnFormat={column.format}` to `ColumnFilterPopover`.
- Commit: 6b958a9
- URL: https://ice-8jznxcbwj-iceerp.vercel.app

## 2026-03-05 (2)
- Summary: Extended shared filter engine to counteragent statement and payment statement pages.
- Changes:
  - Counteragent statement: Replaced local FilterPopover (~190 lines) with shared `ColumnFilterPopover`; migrated `Map<ColumnKey, Set<any>>` to `FilterState`; added cross-filter facet data via `buildFacetBaseData`/`buildUniqueValuesCache`; added numeric/text/date condition filter support.
  - Payment statement: Added filters from scratch (previously had none); added `FilterState`, sort state, `filteredTransactions` memo (filters applied after cumulative calculation to preserve paidPercent/due/balance integrity); added `ColumnFilterPopover` to all 17 column headers; updated entry count, empty check, A/O eligibility, table body, and totals row to use filtered data.
- Commit: afffdd6
- URL: https://ice-dsb4bv6fp-iceerp.vercel.app

## 2026-03-05
- Summary: Unified shared filter engine across all 13 table components with industry-standard numeric/text/date condition operators.
- Changes:
  - New: `components/figma/shared/table-filters.ts` — shared filter engine with `FilterState` type, `matchesFilter()`, and predicates for facet/numeric/text/date modes.
  - Updated: `components/figma/shared/column-filter-popover.tsx` — added tabbed UI (Values + Condition) with numeric operators (>, <, between, =, ≠, blank, not blank), text operators (contains, starts with, ends with, equals, blank), and date operators (=, >, <, between, blank).
  - Migrated 13 tables to shared `FilterState`: salary-accruals, payments, payments-ledger, bank-accounts, conversions, parsing-scheme-rules, counteragents, countries, entity-types, projects, jobs, bank-transactions, payments-report.
  - Backward-compatible: existing facet/checkbox filters work identically; numeric/text/date condition filters are additive.
  - All localStorage persistence auto-converts between legacy and new format.
- Commit: cab54c7
- URL: https://ice-by6528ffv-iceerp.vercel.app

## 2026-03-04
- Summary: Add confirmed column to salary_accruals table + conditional row formatting.
- Changes:
  - Schema: Added `confirmed Boolean @default(false)` column to `salary_accruals` model + DB migration.
  - API (payments-ledger/confirm): Also updates `salary_accruals.confirmed = true` for matching payment_ids.
  - API (payments-ledger/deconfirm): Also updates `salary_accruals.confirmed = false` for matching payment_ids.
  - API (salary-accruals): Reads `confirmed` directly from `salary_accruals` table instead of deriving from `payments_ledger`.
  - UI (salary-accruals-table): Conditional row colors: confirmed + month_balance < 0 → slight red (#ffebee), > 0 → slight green (#e8f5e9), = 0 → slight gray (#f3f4f6). Bold red counteragent name when cumulative_balance < 0.
- Commit: 4d81b5f
- Production: https://ice-g1r5lpyvj-iceerp.vercel.app

## 2026-03-04
- Summary: Fix salary accruals confirmed status always showing false.
- Changes:
  - API (salary-accruals): replace `Boolean(accrual.confirmed)` (nonexistent column, always false) with `confirmedKeys.has(paymentKey)` which correctly derives confirmed status from `payments_ledger` entries.
- Commit: 6158a2a
- Production: https://ice-prtbfjfg0-iceerp.vercel.app

## 2026-03-04
- Summary: Fix audit log Prisma binary protocol error (22P03) on bulk-bind.
- Changes:
  - lib/audit.ts: replace `prisma.auditLog.create()` with raw SQL INSERT to avoid `incorrect binary data format in bind parameter 3` error caused by BigInt id + Json? column combination in Prisma 6.x binary protocol.
- Commit: 3f1f296
- Production: https://ice-chvwj50ts-iceerp.vercel.app

## 2026-03-02
- Summary: Fix batch partition amounts, salary accruals optimization, and batch editor flow fixes.
- Changes:
  - API (8 routes): fix `COALESCE(nominal_amount, partition_amount)` → `COALESCE(NULLIF(nominal_amount, 0), partition_amount)` so zero nominal_amount falls through to partition_amount in salary balance calculations.
  - API (bank-transactions): expose `account_currency_code` in response for batch partition rows.
  - API (salary-accruals): compute paid amounts server-side, removing redundant client-side `/api/bank-transactions?limit=0` fetch; expand paidRows query to all 10 `SOURCE_TABLES`.
  - UI (payment-statement): add missing `batchId` and `accountCurrencyCode` field mappings in `openBankEditDialog` so batch editor loads partitions correctly.
  - UI (counteragent-statement): add diagnostic debug bar for empty-table troubleshooting.
  - UI (batch-editor): fix salary payment ID options to use synthetic `salary__<pid>` recordUuid pattern.
  - UI (salary-accruals-table): remove redundant bank-transactions fetch now that paid amounts come from server.
- Commit: efe5849
- Production: https://ice-i2ve7hgm1-iceerp.vercel.app

## 2026-03-02
- Summary: Optimize counteragent statement bulk edit with single bulk-bind endpoint.
- Changes:
  - API: add `/api/bank-transactions/bulk-bind` PATCH endpoint that groups synthetic IDs by source table, batch-fetches rows and NBG rates, and executes single `UPDATE…FROM(VALUES)` per table.
  - Counteragent statement UI: replace N individual `fetch` calls with a single bulk request.
  - Performance: reduces ~5N DB queries to ~7 total regardless of selection size.
- Commit: 2196e0d

## 2026-03-02
- Summary: Add inventory dictionary tables and waybill items CRUD.
- Changes:
  - Schema: add dimensions, inventory_groups, inventories, and rs_waybills_in_items Prisma models with relations and indexes.
  - API: add CRUD routes for dimensions, inventory-groups, inventories, and waybill-items with audit logging.
  - UI: add dictionary pages with forms, tables, dropdowns, and XLSX export for all four entities.
  - Navigation: add Dimensions, Inventory Groups, Inventories, and Waybill Items links to dictionaries index.
- Commit: 089b83b

## 2026-03-02
- Summary: Waybills filters now stay reliable when facet values are not yet loaded.
- Changes:
  - Waybills table: only compact filter payloads (`all selected` / `all non-blank`) when trusted server facet values are available.
  - Waybills table: avoid fallback compaction from current page rows, preventing accidental filter drops.
  - Waybills filters: preserve selected values in requests until facet data confirms safe compaction.
- Commit: 7efd996
- Production: https://ice-68gt3z84y-iceerp.vercel.app

## 2026-03-02
- Summary: Waybills filter/sort state now uses TanStack Table primitives for more stable behavior.
- Changes:
  - Waybills table: migrate filter state to `ColumnFiltersState` and sorting state to `SortingState` via `useReactTable`.
  - Waybills table: preserve existing filter UI/API behavior, including compact non-blank token serialization and localStorage restore.
  - Waybills table: fix hook dependency stability by memoizing row selection and cell value helpers.
- Commit: 586a611
- Production: https://ice-17xyk8tuf-iceerp.vercel.app

## 2026-03-02
- Summary: Waybills filters now avoid oversized query URLs and load reliably for large selections.
- Changes:
  - Waybills table: compact filter serialization for large selections, including an `all non-blank` token instead of sending thousands of values.
  - Waybills API: parse compact non-blank token and apply equivalent server-side filter clauses.
  - App routing: add `favicon.ico` route handler to eliminate repeated 404 console noise.
- Commit: 5476fcb
- Production: https://ice-gzmwcwutd-iceerp.vercel.app

## 2026-03-02
- Summary: Waybills column filters now correctly support "all except blank" selection.
- Changes:
  - Shared column filter popover: `Select all` now selects all filtered values, not only the visible capped subset.
  - Shared column filter popover: `Select all` count now reflects full filtered value count.
  - Waybills filters: unchecking `(Blank)` after `Select all` now reliably shows all non-blank rows.
- Commit: 7b4aadb
- Production: https://ice-pfoog5333-iceerp.vercel.app

## 2026-02-28
- Summary: Salary accruals table now supports confirm/deconfirm actions with confirmation status.
- Changes:
  - Salary accruals API: include `confirmed` field by aggregating matching ledger rows for each payment ID.
  - Salary accruals table UI: add `Confirmed` column and highlighted row state for confirmed records.
  - Salary accruals table UI: add Confirm and Deconfirm actions for selected rows, reusing payments-ledger endpoints with month-based max-date cutoff.
- Commit: 7617975
- Production: https://ice-8ejkunzz7-iceerp.vercel.app

## 2026-02-28
- Summary: Salary accruals page now supports direct XLSX export.
- Changes:
  - Salary accruals table UI: add `Export XLSX` action in the toolbar.
  - Salary accruals export: download current filtered and sorted records (all matching rows, not just current page).
  - Salary accruals export: include visible columns in current order and preserve computed values for month/cumulative/balance fields.
- Commit: 05cb93e
- Production: https://ice-r0rk5byfh-iceerp.vercel.app

## 2026-02-28
- Summary: Salary accruals table now includes cumulative accrual/payment/balance columns.
- Changes:
  - Salary accruals table UI: add `Cumulative Accrual`, `Cumulative Payment`, and `Cumulative Balance` columns.
  - Salary accruals table UI: compute cumulative values by employee and currency across period-ordered rows while preserving month balance logic.
  - Salary accruals table UI: apply computed-column accessors consistently for rendering, sorting, filtering, facets, and data updates.
- Commit: b88d0f3
- Production: https://ice-cyidslwo6-iceerp.vercel.app

## 2026-02-28
- Summary: Salary accruals table now preserves insurance fields as stored (no client-side swap).
- Changes:
  - Salary accruals table UI: remove insurance normalization that swapped `surplus_insurance` and `deducted_insurance` when surplus was greater.
  - Salary accruals table UI: preserve API/DB insurance values as-is in table rendering and edit normalization helpers.
  - Scope: fixes remaining inversion seen in Salaries Accrual table after prior API-only patch.
- Commit: 326c5d2
- Production: https://ice-c38av2n8z-iceerp.vercel.app

## 2026-02-28
- Summary: Salary accrual insurance fields now return stored values without auto-swap.
- Changes:
  - Salary accruals API: remove insurance normalization that swapped `surplus_insurance` and `deducted_insurance` when surplus was greater.
  - Salary accruals API: preserve DB values as-is so deductible/surplus display matches stored data for all employees.
  - Verification: confirmed reported case (`0c7f8db5-32e0-420b-b059-ca204377f0f3`, `PRL022026`) returns `deducted_insurance=null`, `surplus_insurance=95.00`.
- Commit: 4506a03
- Production: https://ice-lw8d6m904-iceerp.vercel.app

## 2026-02-27
- Summary: Salary accrual insurance copy and TBC upload report totals updates.
- Changes:
  - Salary accruals copy-latest: when creating next-month rows, copy only `surplus_insurance` and set `deducted_insurance` to null.
  - TBC insurance upload API: detect insurance cost column aliases and compute deducted insurance as `insurance_cost - surplus_insurance`.
  - TBC insurance upload report: expose file-level and matched split totals (cost, surplus, deductable) in confirmation summary.
- Commit: 2a58e59
- Production: https://ice-6d6jwaa4x-iceerp.vercel.app

## 2026-02-27
- Summary: Salary accrual paid uses ABS of signed aggregate.
- Changes:
  - Salary accruals API: switch paid aggregation from `SUM(ABS(...))` to `ABS(SUM(...))` for bank nominal amounts.
  - Salary accruals table fallback: accumulate signed paid totals and apply absolute value at final display.
  - Salary accruals totals: align with requested `abs(aggregate of +/-)` business rule.
- Commit: de1e339
- Production: https://ice-gca47fjgw-iceerp.vercel.app

## 2026-02-27
- Summary: Salary accrual paid aggregation scoped by counteragent.
- Changes:
  - Salary accruals API: include `counteragent_uuid` in paid aggregation grouping and lookup keys to prevent cross-counteragent leakage on shared payment IDs.
  - Salary accruals API: retain batch sign normalization and per-transaction absolute paid aggregation behavior.
  - Salary accruals parity: align salary paid totals with counteragent statement when filtering salary payment IDs for a specific employee.
- Commit: 65aff0f
- Production: https://ice-oyafr0zlf-iceerp.vercel.app

## 2026-02-27
- Summary: Salary accrual paid parity fix for batch sign normalization.
- Changes:
  - Salary accruals API: align batch partition nominal sign handling with statement/bank APIs before `SUM(ABS(...))` aggregation.
  - Salary accruals API/UI: normalize payment-id matching keys using statement-style base ID normalization (strip optional `:suffix`, lowercase).
  - Salary accruals totals: preserve per-transaction absolute paid aggregation while restoring parity with counteragent statement/bank transactions.
- Commit: 7b8aa40
- Production: https://ice-4yvf0pmy9-iceerp.vercel.app

## 2026-02-27
- Summary: Salary accrual paid/statement parity correction.
- Changes:
  - Salary accruals paid: revert to sum of absolute transaction amounts (`SUM(ABS(...))`) for parity with counteragent statement totals.
  - Salary accruals table fallback aggregation: use per-transaction absolute summing to match API totals.
  - Salary accruals month balance remains derived from paid absolute total (`net - paid - deductions`).
- Commit: 1159f8d
- Production: https://ice-5oqopzcbm-iceerp.vercel.app

## 2026-02-27
- Summary: Salary accrual month filter fix and absolute paid aggregation parity.
- Changes:
  - Salary accruals filter: fix Month facet values rendering as `[object Object]` by using primitive filter values with formatted labels.
  - Salary accruals paid: compute `paid` as absolute of aggregated `+/-` bank amounts.
  - Salary accruals month balance: derive from absolute paid total for parity with table expectations.
- Commit: 9d9567a
- Production: https://ice-23z4dvkrk-iceerp.vercel.app

## 2026-02-27
- Summary: Signed salary paid aggregation and statement subtotal semantics alignment.
- Changes:
  - Salary accruals API/UI: switch paid aggregation from absolute to signed nominal sums.
  - Counteragent statement: clarify subtotal labels for Payment/PPC as signed values.
  - Parsing rules apply (`test-rule`/`batch-run`): derive effective counteragent/financial code/currency from linked payment when rule fields are null.
- Commit: e95a3e1
- Production: https://ice-gug5ts6ii-iceerp.vercel.app

## 2026-02-27
- Summary: Parsing-rule nominal amount conversion fix and statement/waybills parity updates.
- Changes:
  - Parsing rules apply (`test-rule`/`batch-run`): when rule changes `nominal_currency_uuid`, recalculate `nominal_amount` using transaction-date NBG rates.
  - Counteragent statement: keep richer payment metadata for salary-linked rows and normalize payment-id matching.
  - Waybills: add top-level period range filter support and persistence wiring.
- Commit: 6bac4af
- Production: https://ice-hsm5ow5ux-iceerp.vercel.app

## 2026-02-27
- Summary: Salary accrual upload/template actions made always visible in toolbar.
- Changes:
  - Salary accruals UI: add direct `Salary Template` and `Upload Salary XLSX` buttons in the table header.
  - Salary accruals UI: keep dropdown options while exposing primary salary upload actions without extra clicks.
- Commit: f07a1d6
- Production: https://ice-ajaod7akn-iceerp.vercel.app

## 2026-02-27
- Summary: Salaries table period-based XLSX upload API and template.
- Changes:
  - Salary accruals: add `upload-period` API to upload XLSX for a selected period with upsert behavior.
  - Salary accruals UI: add Upload XLSX action for Salary Accruals (Period) with month + file dialog.
  - Salary accruals: add downloadable Excel template for period upload from API and templates folder.
- Commit: 5435574
- Production: https://ice-f4aj5eajx-iceerp.vercel.app

## 2026-02-27
- Summary: Stabilize Waybills API against UUID parse failures and pool timeouts.
- Changes:
  - Waybills API: sanitize malformed UUID values in `rs_waybills_in` UUID columns before list/facet reads.
  - Waybills API: validate UUID inputs in single and bulk PATCH routes to block invalid writes.
  - Waybills API: run list/count/facet queries sequentially to avoid Prisma pool timeouts in low-connection environments.
- Commit: 7358dca
- Production: https://ice-m069f4ixs-iceerp.vercel.app

## 2026-02-27
- Summary: Waybills column clipping parity with Payments Report and blank rendering alignment.
- Changes:
  - Waybills table: use Payments Report-style overflow clipping/truncation when columns are resized.
  - Waybills table: render empty values as true blanks (no `-`) to align with blank filtering behavior.
- Commit: c91c702
- Production: https://ice-ju7ft7h4t-iceerp.vercel.app

## 2026-02-27
- Summary: Waybills filter options restored, blank-first filters, refresh control, and header overlap fix.
- Changes:
  - Waybills filters: restore facet options rendering and include `(Blank)` values at top of filter lists.
  - Waybills API: preserve blank facet values and align filtering logic with active-column exclusion.
  - Waybills table: add Payments Report-style manual refresh button with loading state.
  - Waybills table: make sticky header opaque to prevent row text overlap while scrolling.
- Commit: 19953b0
- Production: https://ice-eapdhqr60-iceerp.vercel.app

## 2026-02-27
- Summary: Waybills filter parity with bank transactions and no-wrap row rendering.
- Changes:
  - Waybills API: facet options now exclude the active column filter to match bank transactions filter behavior.
  - Waybills table: split records/facets fetching for faster filter response.
  - Waybills table: keep cell text single-line during resize so rows do not grow in height.
- Commit: 1896fac
- Production: https://ice-fmbkk7k9q-iceerp.vercel.app

## 2026-02-27
- Summary: Waybills de-binding options for project/financial code/corresponding account.
- Changes:
  - Waybills edit/bulk edit: keep explicit No options to clear project, financial code, and corresponding account.
  - Waybills bulk API: support explicit null updates so clearing values is applied correctly.
- Commit: ecbd3bb
- Production: https://ice-l0qm4vxv7-iceerp.vercel.app

## 2026-02-27
- Summary: Parsing rules scan full raw tables and count correctly.
- Changes:
  - Parsing rules test/batch: scan raw tables in batches to avoid missing older rows.
  - Parsing rules apply: set `applied_rule_id` on deconsolidated updates for accurate counts.
- Commit: 2c4864c
- Production: https://ice-aqix4jj0r-iceerp.vercel.app

## 2026-02-27
- Summary: Parsing rules update correct deconsolidated tables.
- Changes:
  - Parsing rules apply: derive deconsolidated table from account + scheme (including BOG_FX) per raw table.
  - Parsing rules apply: update `payment_id` and other parameters even when counteragent is empty.
- Commit: 2c4864c
- Production: https://ice-gg9yjyzr7-iceerp.vercel.app

## 2026-02-26
- Summary: Parsing rules preview shows debit/credit and parties.
- Changes:
  - Parsing rules test: map raw fields into preview columns and format records consistently.
  - Parsing rules apply: update the raw table that actually matched the rule.
- Commit: 2c4864c
- Production: https://ice-5bar91bmm-iceerp.vercel.app

## 2026-02-26
- Summary: Parsing rules test-rule JSON handles BigInt values.
- Changes:
  - Parsing rules test: sanitize matching records so BigInt values serialize safely in JSON responses.
- Commit: 2c4864c
- Production: https://ice-of1iacb23-iceerp.vercel.app

## 2026-02-26
- Summary: Parsing rules evaluate against scheme raw tables.
- Changes:
  - Parsing rules test/batch: load raw_table_name list from the rule's parsing scheme and evaluate across those tables.
  - Parsing rules: validate raw table names before querying.
- Commit: 2c4864c
- Production: https://ice-i94zgeu20-iceerp.vercel.app

## 2026-02-26
- Summary: Bank accounts edit dialog dropdowns fixed.
- Changes:
  - Bank accounts API: return balanceDate and isActive fields used by the edit dialog.
  - Bank accounts UI: load banks/currencies from API response shape and active flags.
- Commit: 2c4864c
- Production: https://ice-kkyei2q1r-iceerp.vercel.app

## 2026-02-26
- Summary: Parsing rules evaluation uses raw column names.
- Changes:
  - Parsing rules: normalize raw row keys for test/batch evaluation to support raw column names (e.g., docsendername).
  - Importer: include sender/beneficiary names and entry credit/debit in rule evaluation context.
- Commit: 2c4864c
- Production: https://ice-mf2d1b39p-iceerp.vercel.app

## 2026-02-26
- Summary: Statement confirmed columns + payment statement sign inversion.
- Changes:
  - Payment statement: include ledger confirmed status in table/export and show Yes/No.
  - Counteragent statement: include ledger confirmed status in table/export and show Yes/No.
  - Statements API: include ledger confirmed flag in payment/counteragent statements.
  - Payment statement: invert bank transaction payment/PPC signs.
- Commit: 2c4864c
- Production: https://ice-9ekqbrqx1-iceerp.vercel.app

## 2026-02-26
- Summary: Payments report project link + bank transactions filter options.
- Changes:
  - Payments report: add project link arrow to open Projects table with a project filter.
  - Projects: apply URL-based project filters on load.
  - Bank transactions: filter dropdown options respect active filters/search; empty cells render blank.
- Commit: 2c4864c
- Production: https://ice-3aejdyllf-iceerp.vercel.app

## 2026-02-25
- Summary: Waybills export all + bank export eligibility.
- Changes:
  - Waybills: export all filtered records with Excel date serials (dd.mm.yyyy).
  - Payments report: bank export filters to Confirmed + Due > 0 with warning prompt.
- Commit: 2c4864c
- Production: https://ice-ehszrj3y2-iceerp.vercel.app

## 2026-02-25
- Summary: Waybills missing counteragents toggle.
- Changes:
  - Waybills: add Missing Counteragents button that appears only when needed.
  - Waybills API: support missing counteragent filtering and counts.
- Commit: 2c4864c
- Production: https://ice-b3lftn4u3-iceerp.vercel.app

## 2026-02-25
- Summary: Waybills filters for all columns with date and period sorting.
- Changes:
  - Waybills: add Date column derived from Activation Time (dd.mm.yyyy).
  - Waybills: enable filters/facets for all columns including sum/activation time.
  - Waybills: sort Period filter values by date descending.
- Commit: 2c4864c
- Production: https://ice-jpk9amz85-iceerp.vercel.app

## 2026-02-25
- Summary: Virtualize Waybills rows for performance.
- Changes:
  - Waybills: render only visible rows with virtualization to reduce memory and freezes.
- Commit: 2c4864c
- Production: https://ice-cdkzka2y1-iceerp.vercel.app

## 2026-02-25
- Summary: Optimize Waybills column resizing and edit labels.
- Changes:
  - Waybills: throttle resize DOM updates to avoid freezing during drag.
  - Waybills: show project_index and financial code validation labels in edit/bulk dialogs.
- Commit: 2c4864c
- Production: https://ice-53y0dgyyw-iceerp.vercel.app

## 2026-02-25
- Summary: Fix Waybills checkbox column width and row rendering.
- Changes:
  - Waybills: fix checkbox column width so it does not overlap the first column.
  - Waybills: memoize row rendering for smoother interaction.
- Commit: 2c4864c
- Production: https://ice-8mcje6m2a-iceerp.vercel.app

## 2026-02-25
- Summary: Waybills column resize parity and persistence.
- Changes:
  - Waybills: match Payments Report drag/resize behavior and fixed column widths.
  - Waybills: persist column layout and filters/search/sort/page size in localStorage.
- Commit: 2c4864c
- Production: https://ice-n2broj6s8-iceerp.vercel.app

## 2026-02-25
- Summary: Waybills filters and bulk edit with counteragent labels.
- Changes:
  - Waybills: bulk edit for project/financial code/corresponding account with cross-page selection.
  - Waybills: filter values come from full-table facets and counteragent labels.
  - Waybills: server-side filters/sort with corrected VAT and orderBy handling.
- Commit: c98456b
- Production: https://ice-4fr62mk6u-iceerp.vercel.app

## 2026-02-25
- Summary: Add checked subtotal, waybills pagination, and labels.
- Changes:
  - Counteragent statement: add Subtotal (checked) for selected rows.
  - Waybills: pagination controls and rows-per-page; show all columns with project/financial code labels.
  - Payment statement: show Adding... on +A&O.
- Commit: 03668ec
- Production: https://ice-pto2lw94j-iceerp.vercel.app

## 2026-02-24
- Summary: Respect A/O selection when adding ledger entries.
- Changes:
  - Payment statement: only set accrual/order when the respective selector is checked.
- Commit: 88df23a
- Production: https://ice-quxb3cvok-iceerp.vercel.app

## 2026-02-24
- Summary: Align payment statement A/O selectors and action buttons.
- Changes:
  - Payment statement: move A/O selector columns to the left, add select-all toggles, and match accrual/order colors.
  - Payment statement: move +A&O and Add Ledger buttons to the left above selectors.
- Commit: d880810
- Production: https://ice-hhhhqtkt1-iceerp.vercel.app

## 2026-02-24
- Summary: Add A/O selectors to payment statement and bulk add ledger entries.
- Changes:
  - Payment statement: add accrual/order selector columns for payment rows and +A&O bulk insert.
  - Payment statement: rename manual add entry button to Add Ledger.
- Commit: 839ad0c
- Production: https://ice-jeeqh5wzl-iceerp.vercel.app

## 2026-02-24
- Summary: Restore +A&O label for payment statement add entry.
- Changes:
  - Payment statement: rename add ledger entry button and dialog title back to +A&O wording.
- Commit: 9b0fd70
- Production: https://ice-owzshbkp5-iceerp.vercel.app

## 2026-02-24
- Summary: Show user emails in payments report and filter by unique emails.
- Changes:
  - Payments report API: aggregate ledger users by email only.
  - Payments report UI: split Users column into distinct emails for filtering.
- Commit: f0dc729
- Production: https://ice-oq4r2ks2c-iceerp.vercel.app

## 2026-02-24
- Summary: Add payments ledger bulk upload and payment fallback in bank transactions test.
- Changes:
  - Payments report: download ledger template, upload XLSX with preview, and confirm bulk insert.
  - Payments ledger API: accept Excel serial dates, enforce required effective date, and validate totals.
  - Bank transactions test API: fall back to payment-linked counteragent/project/financial code.
- Commit: a853d9f
- Production: https://ice-9i0mydvf8-iceerp.vercel.app

## 2026-02-23
- Summary: Widen counteragent statement edit dialog and add bank statement assets.
- Changes:
  - Counteragent statement: update local row data after bank/ledger edits.
  - Bank transactions: widen edit dialog.
  - Data/SQL: add bank statement files and deconsolidated table scripts.
- Commit: 107f6ed
- Production: https://ice-4mg9o97s1-iceerp.vercel.app

## 2026-02-23
- Summary: Show payment total in payments report totals bar.
- Changes:
  - Payments report: add payment to per-currency totals cards.
  - Ledger guard script: update confirmed edit error message text.
- Commit: 7a11c59
- Production: https://ice-47h8vqqvy-iceerp.vercel.app

## 2026-02-23
- Summary: Show accrual and order totals in payments report totals bar.
- Changes:
  - Payments report: add accrual and order values to per-currency totals cards.
- Commit: b960575
- Production: https://ice-2cwmjlh0f-iceerp.vercel.app

## 2026-02-23
- Summary: Use conversion_entries for conversion transactions and populate it on import.
- Changes:
  - Bank transactions APIs: load conversion rows from conversion_entries instead of synthesizing from conversion/raw tables.
  - Deconsolidated importer: upsert OUT/FEE/IN conversion_entries rows when conversions are created.
- Commit: ea3ebd4
- Production: https://ice-45yo5g9dt-iceerp.vercel.app

## 2026-02-23
- Summary: Improve bank transactions test filtering and payment selector details.
- Changes:
  - Bank transactions test API: push date filtering into SQL, avoid total count work when filtered, and cache raw lookups for conversions.
  - Bank transactions UI: send explicit limit=0 for all records and enrich payment selector rows with metadata.
  - Deploy config: ignore local artifacts via .vercelignore.
- Commit: 5cb15e7
- Production: https://ice-rjd6tdf7w-iceerp.vercel.app

## 2026-02-23
- Summary: Update bank export file naming and counteragent naming.
- Changes:
  - Payments report API: include counteragent entity type fields for export naming.
  - Payments report: rename BOG export file and standardize counteragent display for BOG/TBC exports.
- Commit: c266967
- Production: https://ice-pvhpd2xc5-iceerp.vercel.app

## 2026-02-23
- Summary: Allow deconfirm and block over-due confirm.
- Changes:
  - Payments ledger API: set session flag to allow deconfirm updates on confirmed rows.
  - Database: add trigger scripts for deconfirm bypass and due > balance confirm guard.
- Commit: 347d5e8
- Production: https://ice-3k8r5qfbm-iceerp.vercel.app

## 2026-02-23
- Summary: Add payments deconfirm action.
- Changes:
  - Payments report: allow deconfirming selected ledger entries with date filter.
  - Payments ledger API: add deconfirm endpoint for selected payment IDs.
- Commit: 03195ab
- Production: https://ice-iwyu1ehid-iceerp.vercel.app

## 2026-02-23
- Summary: Add Users column to payments report.
- Changes:
  - Payments report: show unique ledger entry creators per payment.
- Commit: 8263cb8
- Production: https://ice-18zk9lwia-iceerp.vercel.app

## 2026-02-23
- Summary: Add TBC beneficiary tax code column.
- Changes:
  - Payments report: include Beneficiary's Tax Code column in TBC export.
- Commit: 0768fbb
- Production: https://ice-r8e16maa9-iceerp.vercel.app

## 2026-02-23
- Summary: Add TBC additional description column.
- Changes:
  - Payments report: include Additional Description column in TBC export with payment IDs.
- Commit: af2d15f
- Production: https://ice-n6c7n8d44-iceerp.vercel.app

## 2026-02-23
- Summary: Adjust TBC export to Transfer within bank format.
- Changes:
  - Payments report: export TBC batch with Account Number, Employee's Name, Amount, Description columns only.
- Commit: 9e26cbb
- Production: https://ice-ibbedracf-iceerp.vercel.app

## 2026-02-23
- Summary: Fix bank payment binding and add TBC export.
- Changes:
  - Bank transactions: use raw payment_id for edit binding and avoid phantom assignments.
  - Audit logs: sanitize JSON values before insert.
  - Payments report: add TBC bank batch export with 6 2 6 payment IDs.
- Commit: 4984955
- Production: https://ice-a1d324jjn-iceerp.vercel.app

## 2026-02-23
- Summary: Fix bank transactions conversion filter for TBC.
- Changes:
  - Bank transactions: avoid conversion_id references on TBC tables.
- Commit: 3bb0cda
- Production: https://ice-2f7oug4ki-iceerp.vercel.app

## 2026-02-23
- Summary: Show only Due in payments report totals.
- Changes:
  - Payments report: display only Due in per-currency totals boxes.
- Commit: 4bbb123
- Production: https://ice-38vtzcypa-iceerp.vercel.app

## 2026-02-19
- Summary: Guard conversion raw lookups for missing columns.
- Changes:
  - Bank transactions: use SELECT * when reading conversion raw rows to avoid missing column errors.
  - Bank transactions test: same SELECT * fallback for conversion raw rows.
- Commit: N/A
- Production: https://ice-p1rl66kvp-iceerp.vercel.app

## 2026-02-19
- Summary: Fix bank-transactions-test conversion_id filter for TBC tables.
- Changes:
  - Bank transactions test: avoid conversion_id reference on TBC sources.
- Commit: N/A
- Production: https://ice-ia9tyl30p-iceerp.vercel.app

## 2026-02-19
- Summary: Fix conversions visibility and align bank transactions test with conversion synthesis.
- Changes:
  - Conversions API: fallback query when bank_uuid join fails so rows still render.
  - Bank transactions test: skip conversion_id rows, inject conversion-derived synthetic records, and set USD/GEL after rate map loads.
- Commit: N/A
- Production: https://ice-l319vcwuz-iceerp.vercel.app

## 2026-02-18
- Summary: Add fallback for projects selector when aggregation fails.
- Changes:
  - Projects API: return base project list if payment aggregation errors.
- Commit: N/A
- Production: https://ice-l319vcwuz-iceerp.vercel.app

## 2026-02-18
- Summary: Restore Add Payment project selector data.
- Changes:
  - Counteragent statement: fetch projects from /api/projects-v2 and log load errors.
- Commit: 3439094
- Production: https://ice-erp.vercel.app

## 2026-02-17
- Summary: Enable BOG USD deconsolidated uploads.
- Changes:
  - Bank transactions upload: route BOG XML to deconsolidated processing and resolve BOG_USD tables.
  - Deconsolidated importer: force BOG_USD scheme for USD accounts.
  - Import script: support BOG_USD table name derivation when missing.
- Commit: a02f46b
- Production: https://ice-oq9ojyouw-iceerp.vercel.app

## 2026-02-18
- Summary: Add conversions report UI.
- Changes:
  - Conversions: new API endpoint returning account and currency labels with full column set.
  - Conversions: new table UI with filtering, resizing, and column reordering.
  - Dictionaries: add Conversions page link.
- Commit: 0e93687
- Production: https://ice-l319vcwuz-iceerp.vercel.app

## 2026-02-18
- Summary: Switch bank XML uploads to Supabase Storage.
- Changes:
  - Bank transactions: upload XML files to Supabase Storage and pass public URLs to the import API.
  - Blob upload route: disable legacy Vercel Blob handler.
- Commit: 54e47dd
- Production: https://ice-ko1t28e0u-iceerp.vercel.app

## 2026-02-18
- Summary: Add upload progress logging for bank XML imports.
- Changes:
  - Bank transactions: show Supabase upload progress and import API status in the log window.
- Commit: d7ae7f0
- Production: https://ice-2nlrbs2f7-iceerp.vercel.app

## 2026-02-18
- Summary: Fix Supabase upload signatures with signed URLs.
- Changes:
  - Storage: add signed upload URL endpoint for bank XML files.
  - Bank transactions: upload XML via signed URLs to avoid signature errors.
- Commit: 6f5aec4
- Production: https://ice-jnhitb4hy-iceerp.vercel.app

## 2026-02-18
- Summary: Redeploy after Supabase env update.
- Changes:
  - Environment: set SUPABASE_URL for signed upload endpoint.
- Commit: N/A
- Production: https://ice-6beiotoux-iceerp.vercel.app

## 2026-02-18
- Summary: Allow server Supabase URL fallback.
- Changes:
  - Supabase server client: fall back to NEXT_PUBLIC_SUPABASE_URL if SUPABASE_URL is missing.
- Commit: 9fab944
- Production: https://ice-mnmgc1qxd-iceerp.vercel.app

## 2026-02-18
- Summary: Revert bank XML upload to direct multipart.
- Changes:
  - Bank transactions: send XML files directly to upload API (no storage bucket).
- Commit: da6b36b
- Production: https://ice-hxm01m7b0-iceerp.vercel.app

## 2026-02-18
- Summary: Show BOG USD records in bank transactions.
- Changes:
  - Bank transactions API: include BOG USD table in list/test and record resolution.
  - Parsing lock: allow BOG USD table updates.
- Commit: b90f4dc
- Production: https://ice-lzjjz5rap-iceerp.vercel.app

## 2026-02-18
- Summary: Show upload logs in-page.
- Changes:
  - Bank transactions: replace popup logs with an in-page dialog.
- Commit: 8feefc2
- Production: https://ice-ftlulgfu9-iceerp.vercel.app

## 2026-02-18
- Summary: Fix payment statement bank edit mapping and restore popup logs.
- Changes:
  - Payment statement API: include source identifiers for correct bank edit mapping and BOG USD table in source list.
  - Bank transactions: restore popup window for detailed upload logs.
- Commit: abf0504
- Production: https://ice-2jtlqk6ia-iceerp.vercel.app

## 2026-02-18
- Summary: Add BOG EUR support and popup fallback logs.
- Changes:
  - Bank transactions: include BOG EUR sources and resolve IDs correctly; allow parsing lock updates.
  - Payment statement: include BOG EUR table in bank sources.
  - Upload logs: fallback to in-page dialog when popup is blocked.
- Commit: 31a20b6
- Production: https://ice-mjhtyj0oz-iceerp.vercel.app

## 2026-02-18
- Summary: Fix EUR scheme fallback for BOG deconsolidated import.
- Changes:
  - Deconsolidated import: handle null parsing_scheme_uuid and map EUR to BOG_EUR.
- Commit: 6e66a0f
- Production: https://ice-6ak34akzj-iceerp.vercel.app

## 2026-02-18
- Summary: Add multi-currency BOG sources.
- Changes:
  - Deconsolidated import: map AED/GBP/KZT/CNY/TRY to BOG schemes.
  - Bank transactions/payment statement: include new BOG currency tables and second USD account.
- Commit: a374d33
- Production: https://ice-f0bpuhgdd-iceerp.vercel.app

## 2026-02-18
- Summary: Fix raw-record lookup for BOG multi-currency tables.
- Changes:
  - Bank transactions raw-record API: include new BOG tables in lookup.
- Commit: ad4ba69
- Production: https://ice-f1brm5f90-iceerp.vercel.app

## 2026-02-17
- Summary: Reset payments report column cache to reveal label.
- Changes:
  - Payments report: force column defaults refresh so Label appears in selector and defaults.
- Commit: 141239d
- Production: https://ice-ggtt1xd3b-iceerp.vercel.app

## 2026-02-17
- Summary: Expose payment label in payments report flows.
- Changes:
  - Payments report: show Label column by default and add label input in Add Payment flow.
- Commit: 47a1851
- Production: https://ice-l2naqwnwd-iceerp.vercel.app

## 2026-02-17
- Summary: Enable payment labels in UI and schema.
- Changes:
  - Payments: show Label column by default in the payments table.
  - Database: add `label` column to payments table via migration.
- Commit: 23a8a1f
- Production: https://ice-nfalvtg66-iceerp.vercel.app

## 2026-02-16
- Summary: Relax payments ledger order/accrual validation to allow corrections.
- Changes:
  - Payments ledger: allow inserts/updates that do not increase order-over-accrual excess.
- Commit: 3358688
- Production: https://ice-otv52tnvr-iceerp.vercel.app

## 2026-02-16
- Summary: Restore payments report bank aggregation after unbound counteragent change.
- Changes:
  - Payments report: use a full bank raw union for aggregation while keeping lean union for unbound counts.
- Commit: 20d3e06
- Production: https://ice-h67rck1md-iceerp.vercel.app

## 2026-02-16
- Summary: Flag counteragents with unbound transactions in payments report.
- Changes:
  - Payments report: mark counteragent statement icon red when unbound transactions exist.
- Commit: eb7534f
- Production: https://ice-g7suwdhp5-iceerp.vercel.app

## 2026-02-16
- Summary: Normalize correction date display in bank transactions tables.
- Changes:
  - Bank transactions list/test: convert correction date values to ISO strings to avoid [object Object].
- Commit: 0d8cf45
- Production: https://ice-dzk0xo3ym-iceerp.vercel.app

## 2026-02-16
- Summary: Enforce correction date validation across UI/API/DB.
- Changes:
  - Bank transactions: clear same-day correction dates in UI and API.
  - Database: add trigger to block correction_date equal to transaction_date.
  - Docs: document correction date rule.
- Commit: 96d23ed
- Production: https://ice-kf2tzg92k-iceerp.vercel.app

## 2026-02-16
- Summary: Load correction dates in bank transaction edit dialog.
- Changes:
  - Bank transactions: accept camelCase/snake_case correction date mapping in list and test views.
- Commit: 84551b2
- Production: https://ice-46brqrpt5-iceerp.vercel.app

## 2026-02-16
- Summary: Prevent object rendering errors in bank transactions.
- Changes:
  - Bank transactions table: stringify object cell values before rendering.
- Commit: 27e336d
- Production: https://ice-5cx0pc2dv-iceerp.vercel.app

## 2026-02-16
- Summary: Fix payments report filter rendering for object values.
- Changes:
  - Payments report: normalize filter values to avoid React object rendering errors.
- Commit: bc17ebf
- Production: https://ice-fz4pm2h7m-iceerp.vercel.app

## 2026-02-16
- Summary: Fix payments report query and conditions restore.
- Changes:
  - Payments report API: fix date filter SQL (AND vs WHERE).
  - Payments report UI: sanitize saved conditions to avoid empty results.
- Commit: b74f3e0
- Production: https://ice-m4148tj25-iceerp.vercel.app

## 2026-02-16
- Summary: Reset all payments report filters.
- Changes:
  - Payments report: Clear Filters now resets search, date, conditions, and saved filter state.
- Commit: ae6aa2f
- Production: https://ice-3h13cqtzn-iceerp.vercel.app

## 2026-02-16
- Summary: Prevent null nominal currency on bank transaction updates.
- Changes:
  - Bank transactions PATCH: when nominal currency is cleared, fall back to account currency and reset exchange rate/nominal amount.
- Commit: 79525cf
- Production: https://ice-39hk4o5nn-iceerp.vercel.app

## 2026-02-16
- Summary: Enforce batch integrity with BTC guards and atomic batch creation.
- Changes:
  - Batch editor/API: require at least 2 partitions and insert partitions atomically.
  - Database: block BTC payment_id without partitions and clear raw BTC on batch delete.
  - Diagnostics: add batch integrity check script.
- Commit: 92ab134
- Production: https://ice-onban2k5r-iceerp.vercel.app

## 2026-02-15
- Summary: Persist bank transactions test filters and add clear filters button.
- Changes:
  - Bank transactions test: save/restore table filters and add Clear Filters control.
- Commit: 61724cf
- Production: https://ice-hu74hqooo-iceerp.vercel.app

## 2026-02-16
- Summary: Export bank transaction dates as Excel dates.
- Changes:
  - Bank transactions: XLSX export writes date serials formatted as dd.mm.yyyy.
- Commit: efcb128
- Production: https://ice-b4fi9eumw-iceerp.vercel.app

## 2026-02-16
- Summary: Populate Batch ID column values in bank transactions tables.
- Changes:
  - Bank transactions: map batch_id into table rows for display and filters.
- Commit: da3d6af
- Production: https://ice-q3fgzcmwt-iceerp.vercel.app

## 2026-02-15
- Summary: Expose batch IDs in bank transactions APIs.
- Changes:
  - Bank transactions APIs: include batch_id so Batch ID column renders.
- Commit: b92ac8b
- Production: https://ice-h24mttwt0-iceerp.vercel.app

## 2026-02-15
- Summary: Reset bank transactions column defaults.
- Changes:
  - Bank transactions: bump column config version so Batch ID shows by default.
- Commit: 8629806
- Production: https://ice-bsg9o8qdx-iceerp.vercel.app

## 2026-02-15
- Summary: Resolve BTC_ batch IDs in statements and show batch IDs in bank transactions.
- Changes:
  - Statements/reports: resolve batch partitions so BTC_ IDs never surface as payment IDs.
  - Bank transactions: show Batch ID column by default.
- Commit: a224166
- Production: https://ice-ql17o3ac1-iceerp.vercel.app

## 2026-02-15
- Summary: Auto-assign counteragent from payment on bank transaction edits.
- Changes:
  - Bank transactions: when payment ID is set and counteragent is empty, assign counteragent from payment.
- Commit: 7a29ae2
- Production: https://ice-mdz6w8u80-iceerp.vercel.app

## 2026-02-13
- Summary: Fix invalid dates during XML import.
- Changes:
  - Bank import: guard invalid Date parsing before toISOString.
- Commit: ce9855b
- Production: https://ice-mucwgghia-iceerp.vercel.app

## 2026-02-13
- Summary: Normalize batch label separators and sign.
- Changes:
  - Batch editor: preserve " | " separators, auto-select payment label, and inject (+)/(-) into financial codes.
- Commit: 686e3f2
- Production: https://ice-rcckfxfkt-iceerp.vercel.app

## 2026-02-13
- Summary: Add job and tax to batch payment labels.
- Changes:
  - Batch editor: labels now include job name and income tax flag.
- Commit: c5fa89c
- Production: https://ice-j8ume1gcj-iceerp.vercel.app

## 2026-02-13
- Summary: Prefill split dialog for single payment transactions.
- Changes:
  - Batch editor: prefill first partition with current payment and amounts when no batch exists.
- Commit: 433df6f
- Production: https://ice-fjblptlvs-iceerp.vercel.app

## 2026-02-13
- Summary: Show partition payment IDs in counteragent statements.
- Changes:
  - Counteragent statement: replace BTC_ batch IDs with partition payment IDs.
- Commit: cce2fea
- Production: https://ice-k40b9actm-iceerp.vercel.app

## 2026-02-13
- Summary: Ensure bank edit dialog opens from statements.
- Changes:
  - Statements: normalize bank transaction IDs before opening bank edit dialog.
- Commit: bc6aa78
- Production: https://ice-nzhqg64c5-iceerp.vercel.app

## 2026-02-13
- Summary: Fix batch editor total when editing partitions.
- Changes:
  - Batch editor: use sum of existing partitions for total validation.
- Commit: cd283d7
- Production: https://ice-9lkkyxvdc-iceerp.vercel.app

## 2026-02-13
- Summary: Fix batch partitions API JSON serialization.
- Changes:
  - Batch partitions: normalize BigInt fields before JSON response.
- Commit: aeeb4bd
- Production: https://ice-2fjm96v0c-iceerp.vercel.app

## 2026-02-13
- Summary: Fix batch selector labels and load splits from partitioned rows.
- Changes:
  - Batch editor: label format now uses payment_id | project name | financial code | currency.
  - Batch editor: load existing partitions via batch_id when record UUID is missing.
- Commit: 57bf51a
- Production: https://ice-4yjuz0zl8-iceerp.vercel.app

## 2026-02-13
- Summary: Load existing batch partitions when opening from statements.
- Changes:
  - Batch editor: allow lookup by batch_id and use it when batch_uuid is not returned.
- Commit: 250db33
- Production: https://ice-84p5ke9kf-iceerp.vercel.app

## 2026-02-13
- Summary: Simplify batch splitter payment labels and show counteragent.
- Changes:
  - Batch splitter: show counteragent name above selectors and strip counteragent from payment labels.
  - Batch splitter: show only project name with payment ID in selectors.
- Commit: c2ac51b
- Production: https://ice-6okc0jm3h-iceerp.vercel.app

## 2026-02-13
- Summary: Move blank filter values to top of selection lists.
- Changes:
  - Filters: sort blank/empty values before other options.
- Commit: f47d4ff
- Production: https://ice-62qp70ikd-iceerp.vercel.app

## 2026-02-13
- Summary: Add label-based batch splitter picker and batch IDs in bank transactions test.
- Changes:
  - Batch splitter: add label dropdown to append payment IDs, clear input after create, show label in partition picker.
  - Bank transactions test: include batch_id derived from raw BTC_ payment IDs.
- Commit: e1656cc
- Production: https://ice-wu43q63l4-iceerp.vercel.app

## 2026-02-13
- Summary: Populate Batch ID from deconsolidated payment IDs.
- Changes:
  - Statements: derive batch id from raw deconsolidated payment_id when BTC_ prefixed.
- Commit: d77c09d
- Production: https://ice-euyfmz0mt-iceerp.vercel.app

## 2026-02-13
- Summary: Surface new columns in counteragent statement column picker.
- Changes:
  - Counteragent statement: merge saved columns with new defaults (Batch ID/ID1/ID2).
- Commit: 0c41326
- Production: https://ice-r8zxl503a-iceerp.vercel.app

## 2026-02-13
- Summary: Fix counteragent statement union type mismatch.
- Changes:
  - Statements: align UNION columns for batch payment id fields.
- Commit: 8e733a2
- Production: https://ice-mk77i0bzq-iceerp.vercel.app

## 2026-02-13
- Summary: Fix statements build after adding batch/id fields.
- Changes:
  - Statements: remove duplicate fields and sticky/relative conflict.
- Commit: 0b16cbc
- Production: https://ice-ghta6y62s-iceerp.vercel.app

## 2026-02-13
- Summary: Restore payments report when label column is missing.
- Changes:
  - Payments/report APIs: fall back when label column is not yet applied.
- Commit: 4561d9c
- Production: https://ice-m9qbmuw5l-iceerp.vercel.app

## 2026-02-13
- Summary: Add payment label, report edit action, and job weight column.
- Changes:
  - Payments: add optional label field and expose it in APIs and UI.
  - Payments report: add edit action and selectable job weight column.
- Commit: 7d4c2ba
- Production: https://ice-6udytrhfe-iceerp.vercel.app

## 2026-02-12
- Summary: Allow entering comma-separated payment IDs to create editable batch partitions.
- Changes:
  - Batch editor: add payment ID input per partition and populate from CSV input without locking.
- Commit: a1b331a
- Production: https://ice-hvw528enq-iceerp.vercel.app

## 2026-02-11
- Summary: Resolve synthetic bank transaction IDs during PATCH updates.
- Changes:
  - Bank transactions: map synthetic IDs to source table/id when query params are missing.
- Commit: 37fb690
- Production: https://ice-r17ysi3dl-iceerp.vercel.app

## 2026-02-11
- Summary: Highlight job name when payment ids share project/job/financial code.
- Changes:
  - Payments report: flag job names when multiple rows share project, job, and financial code.
- Commit: 389ceb4
- Production: https://ice-2utjgecyt-iceerp.vercel.app

## 2026-02-11
- Summary: Add verbose logging for FIFO redistribution calculations.
- Commit: d8688b6

## 2026-02-11
- Summary: Align salary accrual paid matching to salary payment IDs with currency-safe fallback.
- Changes:
  - Salary accruals: match paid totals by payment_id and nominal currency with safe fallback for single-currency IDs.
- Commit: 10cbf18
- Production: https://ice-rjhvkl885-iceerp.vercel.app

## 2026-02-11
- Summary: Include batch partitions in salary accrual paid totals and keep payment redistribution selections aligned with filters.
- Changes:
  - Salary accruals: paid aggregation now accounts for batch partitions.
  - Payment redistribution: filter-aware select-all for accruals and payments.
- Commit: 2fe71d7
- Production: https://ice-lr4yynic0-iceerp.vercel.app

## 2026-02-11
- Summary: Update FIFO redistribution apply to write deconsolidated fields.
- Changes:
  - Payment redistribution FIFO: include target metadata in updates and persist into deconsolidated table records.
- Commit: bb8db5a
- Production: https://ice-gufgtqgd2-iceerp.vercel.app

## 2026-02-11
- Summary: Fix FIFO redistribution build by normalizing projected salary payment IDs.
- Changes:
  - Payment redistribution FIFO: normalize payment ID types and projected base ID handling for build.
- Commit: 16b628c
- Production: https://ice-5n6p41rh6-iceerp.vercel.app

## 2026-02-11
- Summary: Add planned salary accrual payment IDs (36-month projection) to the payment redistribution list.
- Changes:
  - Payment redistribution: include salary_accruals projection rows for next 36 months.
- Commit: 07c735f
- Production: https://ice-ildmscwjh-iceerp.vercel.app

## 2026-02-12
- Summary: Add FIFO-based payment redistribution with salary net calculations and split batch application.
- Changes:
  - Payment redistribution: FIFO plan/apply endpoints with salary accrual net logic and batch splits.
  - UI: FIFO run/apply controls and results display.
- Commit: 779d016
- Production: https://ice-xwt8hscz6-iceerp.vercel.app

## 2026-02-11
- Summary: Added refresh controls for projects lists and removed the payments export row cap by exporting from a full dataset fetch.
- Changes:
  - Projects pages: refresh button + no-store fetch on admin and dictionaries.
  - Payments: export fetches full dataset and applies filters/sort; API ignores non-numeric limit values.
- Commit: 37d6692 (app changes: 415df4a)
- Production: https://ice-ei576gt7q-iceerp.vercel.app (build fixed)

## 2026-02-11
- Summary: Fix Supabase duplicate lookup by reducing REST IN() batch size to avoid URL length errors.
- Changes:
  - Importer: reduce duplicate UUID lookup batch size from 1000 to 200.
- Commit: 0b55416
- Production: https://ice-izdiriguj-iceerp.vercel.app

## 2026-02-11
- Summary: Avoid Supabase 406 errors when bank account lookup returns no rows during XML import.
- Changes:
  - Upload API: use maybeSingle for bank account lookups (main + test routes).
- Commit: a0403b3
- Production: https://ice-66a6anc24-iceerp.vercel.app

## 2026-02-11
- Summary: Fix currencies page crash by handling API response shape.
- Changes:
  - Currencies page: read result.data when API returns { data: [...] }.
- Commit: 4222952
- Production: https://ice-7monwh5jg-iceerp.vercel.app
