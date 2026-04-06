# Deployment Log

## 2026-04-06 (147)
- Summary: Properly resolve React hydration errors by removing conditional Dialog rendering.
- Changes:
  - `components/figma/payment-attachments.tsx`: Removed `mounted` state pattern that caused server/client HTML mismatch; Dialog component now always renders (no conditional wrapping); data fetching deferred until dialog opens via `isDialogOpen` useEffect dependency; fixed duplicate closing tags and syntax errors.
- Notes: Previous approach conditionally rendered Dialog based on `mounted` state, causing SSR HTML to not match initial client render. New approach always renders the Dialog structure but only fetches data when actually opened, eliminating hydration mismatches while maintaining performance.
- Commit: ca7f15f
- Production: https://ice-h0cjiyfsp-iceerp.vercel.app

## 2026-04-06 (146)
- Summary: Fix React hydration errors in PaymentAttachments component and improve error messages for Supabase Storage.
- Changes:
  - `components/figma/payment-attachments.tsx`: Added `mounted` state to prevent SSR/client hydration mismatches; changed to load attachments only when dialog opens (not on every mount); wrapped Dialog in conditional render; improved error messages to mention bucket creation requirement.
  - `app/api/payments/attachments/upload/route.ts`: Enhanced error handling with actionable hints when storage bucket doesn't exist (e.g., "The storage bucket 'payment-attachments' may not exist. Please create it in the Supabase dashboard...").
- Notes: React errors #418 and #422 were hydration mismatches caused by immediate data fetching in useEffect. Now deferred until dialog interaction. Upload failures will show helpful guidance to create the Supabase Storage bucket.
- Commit: 7d8296d
- Production: https://ice-iskkn4gin-iceerp.vercel.app

## 2026-04-06 (145)
- Summary: Fix UUID type casting in getPaymentAttachments subquery.
- Changes:
  - `lib/attachments.ts`: Added `::uuid` cast to subquery result in WHERE clause — PostgreSQL was interpreting the subquery `(SELECT record_uuid FROM payments WHERE payment_id = $1 LIMIT 1)` as text type, causing "operator does not exist: uuid = text" error when comparing with `al.owner_uuid` (UUID). Now explicitly casts subquery result to UUID.
- Commit: 3ad4240
- Production: https://ice-r2qh6ypab-iceerp.vercel.app

## 2026-04-06 (144)
- Summary: Fix UUID type comparison error in getPaymentAttachments query.
- Changes:
  - `lib/attachments.ts`: Removed incorrect `::text` cast from record_uuid in WHERE clause — `al.owner_uuid` (UUID) was being compared to `record_uuid::text` (text), causing PostgreSQL error "operator does not exist: uuid = text". Query now compares UUID to UUID correctly.
- Commit: 56be0b7
- Production: https://ice-7ui2mf98r-iceerp.vercel.app

## 2026-04-06 (143)
- Summary: Add payment attachments system with upload/download/delete via payment_id binding.
- Changes:
  - `prisma/schema.prisma`: Added `attachments` and `attachment_links` models for polymorphic file storage; added `attachments` relation to `document_types`.
  - `prisma/migrations/20260406150000_add_attachments_base/migration.sql`: Created `attachments` table (file metadata, storage location, document type FK) and `attachment_links` table (polymorphic owner binding).
  - `lib/attachments.ts`: Service layer functions for CRUD operations: `getPaymentAttachments`, `createPaymentAttachment`, `deletePaymentAttachment`, `getAttachmentDownloadUrl`, `updateAttachment`.
  - `app/api/payments/attachments/route.ts`: GET endpoint to list attachments for a payment.
  - `app/api/payments/attachments/upload/route.ts`: POST endpoint to get signed Supabase upload URL.
  - `app/api/payments/attachments/confirm/route.ts`: POST endpoint to confirm upload and create database records.
  - `app/api/payments/attachments/download/route.ts`: GET endpoint to get signed download URL.
  - `app/api/payments/attachments/delete/route.ts`: DELETE endpoint to remove attachment link and storage file.
  - `components/figma/payment-attachments.tsx`: Reusable UI component with upload dialog, file list, download/delete actions, attachment count badge.
  - `components/figma/payments-table.tsx`: Integrated `PaymentAttachments` component in Actions column.
  - `components/figma/payments-report-table.tsx`: Integrated `PaymentAttachments` component in Actions column.
  - `docs/PAYMENT_ATTACHMENTS.md`: Complete usage guide and Supabase setup instructions.
  - Applied Phase 1 dictionaries: currencies, document_types, project_states, mi_dimensions.
- Storage: Supabase Storage bucket `payment-attachments` (private, access via signed URLs).
- Commit: 5da1420
- Production: https://ice-kxlz2kjrh-iceerp.vercel.app

## 2026-04-03 (142)
- Summary: Fix null-safe conversion_id check in deconsolidated BOG import.
- Changes:
  - `lib/bank-import/import_bank_xml_data_deconsolidated.ts`: Added optional chaining (`outRow?.conversion_id || inRow?.conversion_id`) to prevent crash when one side of a conversion pair is null.
- Commit: 293f050
- Production: https://ice-ba3d76xts-iceerp.vercel.app

## 2026-04-03 (141)
- Summary: Add Job Title text field for employees in counteragents; display in salary accruals table.
- Changes:
  - `prisma/schema.prisma`: Added `job_title String?` to `counteragents` model.
  - `prisma/migrations/20260403000000_add_job_title_to_counteragents`: `ALTER TABLE counteragents ADD COLUMN IF NOT EXISTS job_title TEXT`.
  - `app/dictionaries/counteragents/api/route.ts`: Added `job_title` to `pick`, `toApi`, POST create body, PUT update handler.
  - `app/dictionaries/counteragents/CounteragentForm.tsx`: Added `job_title` to form state; shows text input field after Department when Is Employee = true.
  - `app/dictionaries/counteragents/[id]/page.tsx`: Pass `job_title` in `initial` for edit mode.
  - `app/api/salary-accruals/route.ts`: Added `c.job_title` to all 3 SQL SELECT queries.
  - `components/figma/salary-accruals-table.tsx`: Added `job_title?: string | null` to `SalaryAccrual` type; added Job Title column after Department.
- Commit: 23b8d4c
- Production: https://ice-6mbef5pav-iceerp.vercel.app

## 2026-04-03 (140)
- Summary: Salary accruals department column; payments report skip-to-ledger counteragent filter; lazy-load counteragents/projects; fix projected salary statement link 404.
- Changes:
  - `app/api/salary-accruals/route.ts`: Added `c.department` to all 3 SQL SELECT queries (GET main, POST copy-latest, POST copy-accrual).
  - `components/figma/salary-accruals-table.tsx`: Added `department?: string | null` to `SalaryAccrual` type; added Department column to `defaultColumns` between Insider and Sex; added `!accrual.projected` guard on statement link.
  - `components/figma/payments-report-table.tsx`: Added `counteragentUuid` to payments state type and `fetchPayments` map; added `skipCounteragentFilter` state; `handleSkipToLedger` now captures selected counteragent into filter; `resetForm` clears filter; ledger step Combobox pre-filtered by counteragent with dismissible info banner; lazy-load of counteragents/projects on dialog open.
- Commit: b98936c
- Production: https://ice-7xfmzb3g2-iceerp.vercel.app

## 2026-04-02 (139)
- Summary: Add XLSX export button to Payment Statement page.
- Changes:
  - `app/payment-statement/[paymentId]/page.tsx`: Added `import * as XLSX from 'xlsx'`, `handleExportXlsx` function (exports `filteredTransactions` with all columns: date, type, accrual, payment, order, ppc, paid%, due, balance, confirmed, comment, user, CA account, account, batch ID, ID1, ID2, created at), and Export XLSX button in page header.
- Commit: 04586b5
- Production: https://ice-7ltv9ovy6-iceerp.vercel.app

## 2026-04-01 (136)
- Summary: Add mandatory Department field (Tbilisi/Batumi/Administration) for employee counteragents.
- Changes:
  - `prisma/schema.prisma`: Added `department String?` field to `counteragents` model.
  - `prisma/migrations/20260401135324_add_department_to_counteragents`: ALTER TABLE adds column, check constraints for valid values and mandatory-for-employees rule; existing employees defaulted to Administration.
  - `app/dictionaries/counteragents/api/route.ts`: `department` added to `pick`, `toApi`, POST create, PUT update.
  - `app/dictionaries/counteragents/CounteragentForm.tsx`: Department select shown (required) when Is Employee = True; clears on unset; validated on submit.
  - `app/dictionaries/counteragents/[id]/page.tsx`: `department` passed in `initial` for edit mode.
- Commit: 49509d2
- Production: https://ice-ajz5hjh0p-iceerp.vercel.app

## 2026-04-01 (135)
- Summary: Batch splitter selector always shows all salary accruals and planned 36-month projections, regardless of transaction counteragent.
- Changes:
  - `components/batch-editor.tsx`: Removed per-counteragent filtering on salary entries. Regular payments still filtered by counteragent; all salary accruals (real + projected) always visible for full batch splitting.
  - `import_bank_xml_data.py`: Case 5 conflict now saves payment_id before returning (previously discarded it).
- Commit: 8977d38
- Production: https://ice-i5jn0prqz-iceerp.vercel.app

## 2026-04-01 (134)
- Summary: Fix garnishment paid amounts not summed correctly in salary accruals.
- Changes:
  - `app/api/salary-accruals/route.ts`: Changed `paidByPaymentOnly` fallback from `if (!paid)` to `if (totalByPaymentId > paid) paid = totalByPaymentId` — when the same salary payment_id appears for both the employee (direct pay) and enforcement bureau (garnishment), the composite-key match previously found only the employee portion. Now the total across all counteragents for a payment_id is used when it exceeds the composite match.
- Commit: 59468c4
- Production: https://ice-ngzbmiuia-iceerp.vercel.app

## 2026-04-01 (133)
- Summary: Fix salary accruals -0 conditional formatting bug and garnishment paid amount not counted.
- Changes:
  - `components/figma/salary-accruals-table.tsx`: Added `|| 0` to `mb` and `cumulBal` to eliminate JavaScript `-0`, preventing false red row backgrounds and red/bold counteragent names.
  - `app/api/salary-accruals/route.ts`: Added `paidByPaymentOnly` fallback map — when composite `payment_id|counteragent_uuid` lookup yields 0, fall back to matching by `payment_id` alone. Fixes wage garnishment transactions (e.g. to enforcement bureau) that carry a salary payment_id but a different counteragent being incorrectly shown as unpaid.
- Commit: 29ba879
- Production: https://ice-rbm8n2uic-iceerp.vercel.app

## 2026-04-01 (132)
- Summary: Batch splitter dialog now shows all salary accruals (including projections) regardless of transaction counteragent.
- Changes:
  - `components/batch-editor.tsx`: `filteredPayments` now exempts salary entries (recordUuid starts with `salary__`) from the counteragentUuid filter — regular payments still filter by counteragent, salary accrual and projected salary options always appear.
- Commit: 14c1c68
- Production: https://ice-8pckgmmai-iceerp.vercel.app

## 2026-04-01 (131)
- Summary: Round month_balance to 2 decimal places before conditional formatting in salary accruals table.
- Changes:
  - `components/figma/salary-accruals-table.tsx`: `mb` now `Math.round(raw * 100) / 100` — row background colors (red/green/gray) are evaluated on the rounded value, matching what's displayed.
- Commit: 19f7919
- Production: https://ice-mjcpv4h1b-iceerp.vercel.app

## 2026-04-02 (130)
- Summary: Fix `salary_month` stored with inconsistent day values causing "Mar 2026" to appear 3× in filter.
- Changes:
  - `app/api/salary-accruals/route.ts`: `periodToDate()` now returns first-of-month (`-01`) instead of last-of-month. POST and PUT handlers call `salaryDate.setUTCDate(1)` to normalize before save.
  - `components/figma/salary-accruals-table.tsx`: `salaryMonthStr` build in import flow changed from last-day-of-month to `01`. Added `getColumnValues` wrapper that deduplicates `salary_month` filter values by YYYY-MM so duplicate months never appear in the filter dropdown.
  - DB: `UPDATE salary_accruals SET salary_month = DATE_TRUNC('month', salary_month)::date` normalized 2863 existing rows to first-of-month.
- Commit: d47f23f
- Production: https://ice-a8t2mx5fz-iceerp.vercel.app

## 2026-04-01 (129)
- Summary: Replace all hardcoded raw table lists with dynamic query from bank_accounts.
- Changes:
  - New `lib/source-tables.ts`: `getSourceTables()` queries `bank_accounts.raw_table_name` at runtime so new bank accounts are automatically included.
  - `payments-report/route.ts`: removed hardcoded `SOURCE_TABLES` (was BOG_GEL + TBC_GEL only), now uses all 14 configured tables — fixes EUR/USD/TRY/etc. transactions not being counted as paid.
  - `bank-transaction-batches/route.ts`: same — GET/POST/DELETE all use dynamic tables.
  - `cron/cash-based-monthly-accruals/route.ts`: same.
  - `salary-accruals/route.ts`: same — GET, PUT, and `remapPaymentIdBindings` use dynamic tables.
  - `salary-report/route.ts`: same.
- Commit: 6d24ac5
- Production: https://ice-6aoux0hic-iceerp.vercel.app

## 2026-03-30 (128)
- Summary: Fix payment ID extraction regex to support space-separated NP/NJ/PRL patterns (TBC bank).
- Changes:
  - Python (`import_bank_xml_data.py`): Strategy 4 regex updated from `NP_[hex]_NJ_[hex]_PRL\d{6}` to `NP[_ ][hex][_ ]NJ[_ ][hex][_ ]PRL\d{6}` with space-to-underscore normalization.
  - TypeScript (`lib/bank-import/db-utils.ts`): Same regex fix in `extractPaymentID()`.
  - Data fix: 22 TBC records and 75 BOG records retroactively updated with extracted payment IDs.
- Commit: 3d5e22e
- Production: https://ice-64yiy7p6s-iceerp.vercel.app

## 2026-03-30 (127)
- Summary: Make "Only due" checkbox take immediate effect in both payment edit dialog and batch splitter.
- Changes:
  - Batch editor: added its own "Only due" checkbox so users can toggle the filter without closing the batch editor overlay. Changes sync back to the parent dialog and localStorage.
  - Parent wiring: added `onOnlyDueChange` callback prop to `BatchEditor`, connected in `bank-transactions-table.tsx`.
- Commit: a64609c
- Production: https://ice-dz7j6z9fq-iceerp.vercel.app

## 2026-03-30 (126)
- Summary: Prevent duplicate salary accrual records + clean up existing March 2026 duplicate.
- Changes:
  - API `copy-latest`: added pre-check — if target month already has records, returns 409 error instead of creating duplicates.
  - API `copy-accrual`: added per-record check — skips months where a record already exists for the same counteragent + financial code combo. Returns `skipped` array.
  - DB: added unique constraint `salary_accruals_ca_fc_month_unique` on `(counteragent_uuid, financial_code_uuid, salary_month)` to prevent duplicates at the database level.
  - Cleaned up 1 existing duplicate record (ID 6151) in March 2026.
  - Prisma schema updated with `@@unique` and migration `20260330191939_add_salary_accruals_unique_constraint`.
- Commit: cf79494
- Production: https://ice-bqe4ceund-iceerp.vercel.app

## 2026-03-30 (125)
- Summary: Show employees in TBC insurance file who have no salary accrual for the selected month.
- Changes:
  - API: after matching employees and querying accruals, detect employees present in the file (with matched counteragent) but without a salary_accruals record for the month. Returns `no_accrual_employees` array with name, ID, and insurance cost.
  - UI: new orange-highlighted section "Employees without salary accrual for this month" in the confirmation dialog showing employee name, ID, and insurance cost.
- Commit: 901750e
- Production: https://ice-3suvenh8s-iceerp.vercel.app

## 2026-03-30 (124)
- Summary: Filter TBC insurance file by `დაზღვეულის ტიპი = თანამშრომელი` before processing.
- Changes:
  - API: after parsing XLSX headers, find `დაზღვეულის ტიპი` column index. When iterating data rows, skip any row where that column value is not `თანამშრომელი`.
  - Response includes `skipped_non_employee` count.
  - UI: shows "Rows in file (თანამშრომელი)" and "Skipped non-employee rows" in the confirmation dialog.
- Commit: 7f7392b
- Production: https://ice-3ysw14oig-iceerp.vercel.app

## 2026-03-30 (123)
- Summary: Fix salary accruals copy-latest showing blank records after copy.
- Changes:
  - DB records were correct (96 March 2026 records with full data), but the POST response was missing fields (`paid`, `confirmed`, `counteragent_iban`, etc.) that the GET endpoint provides.
  - Previously: response records were merged directly into table state with incomplete data, appearing blank.
  - Fix: after successful copy, refetch all data via `fetchData()` instead of merging the incomplete POST response. This ensures new records get full computed columns (paid amounts, balances, etc.).
- Commit: a63a273
- Production: https://ice-1spzc93f8-iceerp.vercel.app

## 2026-03-30 (122)
- Summary: Fix salary accruals copy-latest-month not working when projected records exist.
- Changes:
  - Root cause: server-side projected accruals (virtual records for periods with bank payments but no accrual rows) were included when computing `latestBaseMonthDate`. The copy API then queried for real DB records in that projected month and found none.
  - Fix: filter out `projected: true` records before computing the latest month and base records for the copy operation (both `projectedMonths > 0` and fallback code paths).
- Commit: 8558e17
- Production: https://ice-oe2voso85-iceerp.vercel.app

## 2026-03-30 (121)
- Summary: Return user-friendly error when deleting confirmed ledger entries.
- Changes:
  - API DELETE handler now catches DB trigger constraint violation (code `23514`) and returns 403 with "Confirmed ledger entries cannot be deleted. Unconfirm the entry first."
  - `payments-ledger-table.tsx` now parses the error response body and shows the server message in the alert.
- Commit: bdff905
- Production: https://ice-5fxbqpvbs-iceerp.vercel.app

## 2026-03-30 (120)
- Summary: Fix payments report sticky filter override from URL query params.
- Changes:
  - After applying URL query params (`counteragentUuid`, `projectUuid`, `jobUuid`) on mount, clear them from the URL via `history.replaceState` so they don't re-apply on subsequent navigations.
- Commit: 6bc7dad
- Production: https://ice-j491t86if-iceerp.vercel.app

## 2026-03-30 (119)
- Summary: Fix UUID type casting in batch partition INSERT query.
- Changes:
  - Added `::uuid` casts to `payment_uuid`, `counteragent_uuid`, `project_uuid`, `financial_code_uuid`, `nominal_currency_uuid` parameters in parameterized INSERT.
- Commit: 7505c9e
- Production: https://ice-c0s3ivo3a-iceerp.vercel.app

## 2026-03-30 (118)
- Summary: Atomic batch replace in batch split editor + SQL injection fix.
- Changes:
  - Batch editor: replaced non-atomic DELETE+POST with single POST that sends `replaceBatchUuid` for atomic in-transaction replace.
  - API POST handler: deletes old batch and inserts new partitions within single DB transaction.
  - Fixed SQL injection: replaced string-interpolated VALUES with parameterized queries ($1..$16).
  - Removed duplicate `formatBatchId` function from POST handler (already at module level).
- Commit: 122197d
- Production: https://ice-mwdwf8279-iceerp.vercel.app

## 2026-03-30 (117)
- Summary: Ensure NBG exchange rates exist before bank XML parsing + 7-day rate fallback.
- Changes:
  - Added ensureNBGRatesExist() to db-utils.ts: checks transaction dates against nbg_exchange_rates, fetches missing from NBG API, upserts.
  - Added pre-parse NBG rate check to all TS processors: deconsolidated, bog-gel-processor, import_bank_xml_data (3 call sites).
  - Added 7-day backward fallback in calculateNominalAmount across all 3 TS files + Python script.
  - Added ensure_nbg_rates_exist() to Python script with same logic (2 call sites: process + backparse).
  - Fixes incorrect nominal amounts when NBG rate is missing for exact transaction date.
- Commit: 402f9f1
- Production: https://ice-3tnio2f9z-iceerp.vercel.app

## 2026-03-27 (116)
- Summary: Differential sync for job-project bindings, payment deletion protection.
- Changes:
  - PUT /api/jobs: Replaced destructive delete-all + re-insert of job_projects with differential sync (only removes/adds changed bindings).
  - DELETE /api/jobs: Added pre-check for active payments, returns 409 if any exist.
  - POST /api/job-projects: Same differential sync fix — no longer deletes all bindings before re-inserting.
  - DB triggers (applied directly): trg_prevent_job_deactivation_with_payments, trg_prevent_job_project_unbind_with_payments.
- Commit: 4ab15ef
- Production: https://ice-hwtpy5iwl-iceerp.vercel.app

## 2026-03-27 (115)
- Summary: Fix cross-project job reuse bug in POST /api/jobs handler.
- Changes:
  - POST /api/jobs duplicate check now also verifies the existing job is bound to one of the target projects via job_projects. Previously matched by (job_name, insider_uuid, brand_uuid) only, causing new jobs to silently append bindings to unrelated existing jobs with the same name.
- Commit: 63caf3d
- Production: https://ice-luj8cxf93-iceerp.vercel.app

## 2026-03-27 (114)
- Summary: Batch editor chip UI for payment IDs, filter used IDs from dropdowns, jobs table URL param filter.
- Changes:
  - Batch editor: replaced plain-text textarea with chip/tag UI for selected payment IDs (non-editable, removable chips). Already-selected IDs filtered out from all combobox dropdowns.
  - Jobs table: added URL query param support (`?jobUuid=`) so links from payments report correctly filter the jobs page.
- Commit: c9df208
- Production: https://ice-9mxxdu7a2-iceerp.vercel.app

## 2026-03-27 (113)
- Summary: Add "Only due" checkbox to bank transaction edit dialog and batch split editor.
- Changes:
  - Edit dialog: checkbox persisted in localStorage filters payment dropdown to show only payments with due > 0 (from payments report).
  - Batch editor: receives onlyDue/duePaymentIds props, applies same filter to partition payment combobox.
- Commit: d8a1738
- Production: https://ice-j7w01526m-iceerp.vercel.app

## 2026-03-27 (109)
- Summary: Add per-day logging to BOG cron import for visibility on empty vs data days.
- Changes:
  - `app/api/cron/bog-import-last-3-days/route.ts`: Log date range per account and per-day transaction counts (data/empty/error).
- Commit: fae8503
- URL: https://ice-mdp08d3pn-iceerp.vercel.app

## 2026-03-27 (108)
- Summary: Add is_project_derived (Auto) column to payments report table and API.
- Changes:
  - API: added p.is_project_derived to payments-report SQL query and response mapping.
  - UI: added isProjectDerived to PaymentReport type, defaultColumns in payments-report-table.
  - Renamed column label from "Source" to "Auto" in both payments-table and payments-report-table.
- Commit: f9b73db
- Production: https://ice-9uo1i6t7h-iceerp.vercel.app

## 2026-03-26 (107)
- Summary: Shared useTableFilters hook migration, Excel-like condition filters for all column types, date column format annotations.
- Changes:
  - `components/figma/shared/use-table-filters.ts`: Shared hook with pageSize/setPageSize state, sort, pagination, search, column filters.
  - `components/figma/shared/table-filters.ts`: Changed `inferFilterMode()` default from 'facet' to 'text' so all column types show Condition tab.
  - 14 table components: Migrated to shared `useTableFilters` hook, added `columnFormat` prop to ColumnFilterPopover, added `format?: ColumnFormat` to ColumnConfig types.
  - Date column annotations: Added `format: 'date'` or `format: 'datetime'` to 16 date columns across 7 tables (counteragents, countries, entity-types, jobs, payments, waybills). Enables proper date filter operators (After, Before, Between).
  - `salary-accruals-table.tsx`: Updated `formatValue()` parameter type to use `ColumnFormat`.
- Commit: 77fc0ef
- Production: https://ice-3w9ti7isl-iceerp.vercel.app

## 2026-03-26 (106)
- Summary: NBG cron retry/resilience, table filter type fixes, useTableFilters shared hook, conversion resolver improvements.
- Changes:
  - `app/api/cron/update-nbg-rates/route.ts`: Added 3-attempt retry with exponential backoff and content-type validation (checks header + body prefix before JSON.parse) for both main and backfill fetches. Fixes transient NBG API HTML error responses.
  - `components/figma/conversions-table.tsx`: Fixed `setCurrentPage` type error (functional updater → direct value).
  - `components/figma/entity-types-table.tsx`: Added missing `useMemo` import, fixed `setCurrentPage` type error.
  - `components/figma/shared/use-table-filters.ts`: New shared table filters hook with sort, pagination, search, faceted filtering.
  - `next.config.js`: Added `_deploy-log` to webpack watch ignored patterns.
  - `lib/bank-import/import_bank_xml_data_deconsolidated.ts`: Enhanced conversion account resolver with `resolveConversionAccountsFromRows` fallback.
  - `scripts/backfill-conversions.ts`: Added `bank_account_uuid` mapping and sync conversion account resolver fallback.
  - `import_bank_xml_data.py`: Minor updates.
  - 2 new Prisma migrations (balance account filter fix, bank API columns).
- Commit: 2039335
- URL: https://ice-uq6i4ea5n-iceerp.vercel.app

## 2026-03-27 (105)
- Summary: Fix currency conversion date parsing, add weekend/holiday rate fallback, add reusable Add Project dialog to 3 pages.
- Changes:
  - `app/api/bank-transactions/[id]/route.ts`: Fix `calculateExchangeRateAndAmount()` — added `toDateStr()` helper to handle Date objects from `$queryRawUnsafe` (was calling `.split('.')` on Date objects causing silent TypeError). Also added weekend/holiday rate fallback: when exact date has no NBG rate, uses latest available rate before that date.
  - `components/figma/add-project-dialog.tsx`: New reusable Add Project dialog component with counteragent locking support.
  - `components/figma/payments-report-table.tsx`: Added Add Project button.
  - `components/figma/services-report-table.tsx`: Added Add Project button.
  - `app/counteragent-statement/[counteragentUuid]/page.tsx`: Added Add Project button with fixed counteragent.
- Data fix: Corrected 2,478 deconsolidated records where payment_id binding set nominal_currency correctly but failed to convert nominal_amount (exchange_rate was null, nominal_amount still equaled GEL account_amount). All records now have proper USD/EUR amounts and exchange rates from NBG.
- Commit: 8058ca6
- URL: https://ice-5b05wy12y-iceerp.vercel.app

## 2026-03-26 (104)
- Summary: Fix auto-payment checkbox visibility in financial codes create/edit forms.
- Changes:
  - `components/financial-codes-table.tsx`: Show "Automated Payment ID" checkbox for all income codes in create/edit dialog (removed parent-of-leaves restriction). Table column shows checkmark for any income code with the flag set.
- Commit: a97dbc4
- URL: https://ice-pg8oug0mw-iceerp.vercel.app

## 2026-03-26 (103)
- Summary: Project-derived payments, delete protection triggers, and financial code auto-payment gating.
- Changes:
  - `prisma/migrations/20260326120000_add_is_project_derived_to_payments/migration.sql`: Adds `is_project_derived BOOLEAN DEFAULT false` to payments table with partial index.
  - `prisma/migrations/20260326130000_prevent_delete_with_transactions/migration.sql`: BEFORE DELETE triggers on payments and projects that block deletion when ledger entries, adjustments, or bank transactions are attached (returns 409 from API).
  - `prisma/migrations/20260326140000_add_automated_payment_id_to_financial_codes/migration.sql`: Adds `automated_payment_id BOOLEAN DEFAULT false` to financial_codes table.
  - `app/api/projects/route.ts`: Auto-creates project-derived payment on POST only when financial code has `automated_payment_id=true`. PATCH syncs/creates/deactivates derived payment based on flag.
  - `app/api/projects/[id]/route.ts`: PUT syncs derived payment with FC flag gating. DELETE checks for attached transactions (409) then deactivates derived payment.
  - `app/api/payments/route.ts`: Blocks PATCH on project-derived payments (403). GET returns `isProjectDerived` field.
  - `app/api/financial-codes/route.ts`: POST/PATCH accept `automatedPaymentId` boolean field.
  - `components/figma/payments-table.tsx`: Source column (Project/Manual badges), edit lockout for auto-created payments.
  - `components/financial-codes-table.tsx`: Auto Payment column visible for income leaf codes, checkbox in edit dialog.
  - `scripts/audit-project-derived-payments.sql`: Audit query for post-migration verification.
- Commit: c8c768f
- URL: https://ice-li9q3y4c8-iceerp.vercel.app

## 2026-03-26 (102)
- Summary: Fix `recompute_bank_account_balance_periods` — remove invalid `updated_at` reference from `DO UPDATE` clause (column does not exist on `bank_account_balances` table).
- Changes:
  - `prisma/migrations/20260326074000_fix_recompute_upsert_no_updated_at/migration.sql`: Replaces the function from migration 20260325113000, keeping the `INSERT ... ON CONFLICT DO UPDATE` idempotent logic but without the `updated_at = now()` line that caused `column "updated_at" does not exist` (code 42703) runtime errors on `PATCH /api/bank-transactions/[id]`.
  - Migration was applied directly to production via direct DB connection before this deploy.
- Commit: d4aefa3
- URL: https://ice-dwnjcj5au-iceerp.vercel.app

## 2026-03-25 (101)
- Summary: Prevent bank account balance recompute conflicts on `(account_uuid, opening_date)` during concurrent updates/import runs.
- Changes:
  - `prisma/migrations/20260325113000_fix_recompute_balance_upsert_conflicts/migration.sql`: Replaced plain inserts inside `recompute_bank_account_balance_periods` with `INSERT ... ON CONFLICT (account_uuid, opening_date) DO UPDATE`, making recomputation idempotent and eliminating 23505/409 conflicts.
- Commit: 3208a68
- URL: https://ice-8xr4fuh64-iceerp.vercel.app

## 2026-03-25 (100)
- Summary: Fix services report column alignment and sticky behavior.
- Changes:
  - `components/figma/services-report-table.tsx`: Merged back to single table (was two separate tables causing column misalignment). Section title + summary boxes sticky outside overflow wrapper; column headers sticky via `<thead sticky>` within `overflow-x-auto` container. Headers have opaque background so content doesn't show through.
- Commit: 85384e2
- URL: https://ice-ijxl691q6-iceerp.vercel.app

## 2026-03-25 (99)
- Summary: Services report sticky column headers, full column resizing, insider_name field fix.
- Changes:
  - `components/figma/services-report-table.tsx`: Column headers now sticky (included in sticky band with section title and summary boxes); table-layout fixed with overflow-hidden + maxWidth on cells; min resize width lowered to 20px matching payments report.
  - `app/api/services-report/route.ts`: Insider column now uses `counteragent.insider_name` (preferred) instead of `counteragent.name`.
- Commit: 8460e9b
- URL: https://ice-fwzt7o3t1-iceerp.vercel.app

## 2026-03-25 (98)
- Summary: Fix BigInt serialization crash in bank-transactions API; adjustments depicted as PPC in payment/counteragent statements; services report Insider & Department columns; counteragent shortcut link.
- Changes:
  - `app/api/bank-transactions/route.ts`: Added BigInt-safe `jsonResponse()` helper using JSON.stringify replacer to fix `TypeError: Do not know how to serialize a BigInt` crash.
  - `app/payment-statement/[paymentId]/page.tsx`: Adjustment rows now use face amount as PPC value instead of 0.
  - `app/counteragent-statement/[counteragentUuid]/page.tsx`: Same PPC adjustment fix.
  - `app/api/services-report/route.ts`: Added insider_name (via counteragents JOIN on insider_uuid) and department from projects table.
  - `components/figma/services-report-table.tsx`: Added Insider and Department columns (hidden by default, selectable from Columns button); counteragent column now has ArrowUpRight shortcut opening counteragents table filtered by name; storage key bumped to V6.
  - `components/figma/counteragents-table.tsx`: Added `initialSearch` prop support.
  - `app/dictionaries/counteragents/CounteragentsTableFigma.tsx`: Reads `?search=` URL param and passes to table component.
- Commit: fc72283
- URL: https://ice-l2rslobwy-iceerp.vercel.app

## 2026-03-25 (97)
- Summary: Edit adjustments from payment statement; services report sticky section headers; summary boxes filter to active service_state only; live nominal amount preview in adjustment dialog.
- Changes:
  - `app/payment-statement/[paymentId]/page.tsx`: Unified add/edit adjustment dialog (Edit2 button on adjustment rows, PATCH for edits); debounced nominal amount preview via API call; state refactored (isAdjustmentDialogOpen, editingAdjustmentId, adjNominalPreview).
  - `components/figma/services-report-table.tsx`: Summary boxes now only aggregate rows with serviceState === 'active'; section header + summary boxes are sticky (top:0 z-20) while scrolling within each financial code grid.
  - `app/api/adjustments/preview-nominal/route.ts`: New GET endpoint — computes nominal amount from face currency inputs using NBG rates for live dialog preview.
- Commit: 7323ccd
- URL: https://ice-2sgd0xktf-iceerp.vercel.app

## 2026-03-25 (96)
- Summary: Added face/nominal currency support to payment adjustments (NBG rate lookup, manual rate override); integrated adjustments into payments report and services report figures (payment/due/balance); moved services report summary boxes to top of grid.
- Changes:
  - `app/api/adjustments/route.ts`: Added NBG rate lookup, computeNominalAmount, face currency support in POST/PATCH, new columns in GET response.
  - `app/api/payment-statement/route.ts`: Added face_currency_code, face_amount, manual_rate, nominal_amount to adjustments query and response.
  - `app/api/counteragent-statement/route.ts`: Same face currency columns added to adjustments query and response.
  - `app/api/payments-report/route.ts`: Added adj_agg CTE; total_payment now includes adjustments.
  - `app/api/services-report/route.ts`: Added adj_agg CTE; payment column now includes adjustments.
  - `app/payment-statement/[paymentId]/page.tsx`: Add Adjustment dialog now has face currency section (currency dropdown, face amount, manual rate); adjustment rows use nominalAmount.
  - `app/counteragent-statement/[counteragentUuid]/page.tsx`: Adjustment rows use nominalAmount, show face currency prefix in comment.
  - `components/figma/services-report-table.tsx`: Moved per-section summary boxes from below to above grid.
  - `prisma/schema.prisma`: Added face_currency_code, face_amount, manual_rate, nominal_amount fields to payment_adjustments model.
  - `apply-payment-adjustments-face-currency-migration.js`: Migration script for new columns (run on both local and production).
- Migration: `apply-payment-adjustments-face-currency-migration.js` run on production Supabase.
- Commit: d2ae873
- URL: https://ice-skm81nats-iceerp.vercel.app

## 2026-03-24 (95)
- Summary: Added Balance to Payments Report summary boxes; added per-section summary boxes (Sum/Accrual/Order/Payment/Due/Balance by currency) to Services Report grids.
- Changes:
  - `components/figma/payments-report-table.tsx`: Added Balance row to per-currency totals boxes.
  - `components/figma/services-report-table.tsx`: Added per-section summary boxes below each financial code grid, grouped by currency.
- Commit: c25af14
- URL: https://ice-fg7llorn7-iceerp.vercel.app

## 2026-03-24 (94)
- Summary: Added payment adjustments feature (CRUD API, payment/counteragent statement integration, UI with add/delete); fixed bank-transaction-batches UUID type-casting bug.
- Changes:
  - `prisma/schema.prisma`: Added `payment_adjustments` model with relation to `payments`.
  - `app/api/adjustments/route.ts`: New CRUD API (GET/POST/PATCH/DELETE) with auth guards and audit logging.
  - `app/api/payment-statement/route.ts`: Added adjustments query to payment statement response.
  - `app/api/counteragent-statement/route.ts`: Added adjustments query for all payment IDs in counteragent statement.
  - `app/payment-statement/[paymentId]/page.tsx`: Added adjustment rows, Add Adjustment dialog, delete action.
  - `app/counteragent-statement/[counteragentUuid]/page.tsx`: Added adjustment rows and delete action.
  - `app/api/bank-transaction-batches/route.ts`: Fixed `uuid = text` operator error by converting string interpolation to parameterized queries with `::uuid` casts.
  - `apply-payment-adjustments-migration.js`: Migration script for `payment_adjustments` table.
- **NOTE**: Run `node apply-payment-adjustments-migration.js` against production DB to create `payment_adjustments` table.
- Commit: e55a626
- URL: https://ice-8jenpzf6s-iceerp.vercel.app

## 2026-03-24 (93)
- Summary: Applied same nominal ISO COALESCE fix to Bank Transactions Test API so batch-split rows display payment/batch nominal currency.
- Changes:
  - `app/api/bank-transactions-test/route.ts`: Updated nominal currency join to use `COALESCE(cba.batch_nominal_currency_uuid, cba.nominal_currency_uuid)` in all listing branches (default, ids, rawRecordUuid).
- Commit: dede579
- URL: https://ice-p28cweplq-iceerp.vercel.app

## 2026-03-24 (92)
- Summary: Fixed Bank Transactions split-batch nominal ISO so partitioned rows use payment/batch nominal currency instead of raw account currency.
- Changes:
  - `app/api/bank-transactions/route.ts`: Updated nominal currency join to use `COALESCE(cba.batch_nominal_currency_uuid, cba.nominal_currency_uuid)` in all listing branches (default, ids, rawRecordUuid).
  - Ensures split transactions display `nominal_currency_code` from assigned payment/batch context when available.
- Commit: 5e60fde
- URL: https://ice-6k9vc11a8-iceerp.vercel.app

## 2026-03-24 (91)
- Summary: Security hardening & code quality audit — auth guards on all mutation API routes, Zod validation, error boundaries, @updatedAt on all Prisma models.
- Changes:
  - `middleware.ts`: Removed hardcoded NEXTAUTH_SECRET fallback, expanded route matcher to protect all app/API routes.
  - `lib/auth-guard.ts`: New shared requireAuth/requireAdmin/isAuthError helpers.
  - `lib/auth.ts`: Removed allowDangerousEmailAccountLinking from Google OAuth.
  - 16 API route files: Added auth guards to 40+ POST/PATCH/PUT/DELETE handlers (counteragents, financial-codes, currencies, banks, countries, entity-types, dimensions, exchange-rates, projects, jobs, brands, bank-accounts, waybills, waybill-items, inventories, inventory-groups).
  - `lib/api-schemas.ts`: New Zod validation schemas for all entity types, integrated into brands/banks routes.
  - 6 route groups: Added loading.tsx and error.tsx boundaries (dictionaries, bank-transactions, admin, counteragent-statement, payment-statement, salary-report).
  - `prisma/schema.prisma`: Added @updatedAt to all models with updated_at fields.
  - `lib/__tests__/`: 21 new unit tests for Zod schemas and auth type guard.
  - `AGENTS.md`: Fixed project structure description.
- Commit: 2e89c6b
- URL: https://ice-oocarrqab-iceerp.vercel.app

## 2026-03-23 (90)
- Summary: Services Report now highlights `Sum` in red bold only when it differs from latest accrual (latest ledger effective date), not from cumulative accrual.
- Changes:
  - `app/api/services-report/route.ts`: Added `latest_accrual` aggregation using per-payment latest `effective_date` from `payments_ledger` and exposed it in API response as `latestAccrual`.
  - `components/figma/services-report-table.tsx`: Updated mismatch rule to `Math.abs(row.sum - row.latestAccrual) > 0.009` for red-bold formatting.
- Commit: f7689be
- URL: https://ice-elosweolp-iceerp.vercel.app

## 2026-03-23 (89)
- Summary: Services Report payment IDs now open full payment edit dialog, and `Sum` red-bold mismatch is shown only when `sum != accrual`.
- Changes:
  - `components/figma/services-report-table.tsx`: Replaced payment-ID-only edit with full payment edit dialog (`paymentId`, `label`, `counteragent`, `financial code`, `currency`, optional `project/job`, `incomeTax`, `isActive`) and save via `PATCH /api/payments?id=...`.
  - `components/figma/services-report-table.tsx`: Removed Payment IDs shortcut link-to-filtered-payments behavior in favor of direct edit action.
  - `components/figma/services-report-table.tsx`: Updated Sum mismatch highlighting logic to compare against latest accrual (`row.accrual`) so matching Sum/Accrual is not red-bold.
- Commit: 9e44413
- URL: https://ice-1f8xf2r7h-iceerp.vercel.app

## 2026-03-21 (88)
- Summary: Services Report now supports inline Payment ID editing and shows `Latest Date` from accrual/order ledger only.
- Changes:
  - `components/figma/services-report-table.tsx`: Added Payment ID edit action in `Payment IDs` column with modal dialog and save flow via `PATCH /api/payments?id=...`.
  - `components/figma/services-report-table.tsx`: Added loading/saving/error handling and report refresh after successful Payment ID update.
  - `app/api/services-report/route.ts`: Changed `latest_date` calculation to `MAX(la.latest_ledger_date)` so payment transaction dates do not affect `Latest Date`.
- Commit: 5730885
- URL: https://ice-9fxnyqurq-iceerp.vercel.app

## 2026-03-21 (87)
- Summary: Services Report XLSX export now creates separate worksheets per section and includes a consolidated Summary worksheet.
- Changes:
  - `components/figma/services-report-table.tsx`: Added `Export XLSX` action for Services Report data.
  - `components/figma/services-report-table.tsx`: Export now writes one worksheet per financial-code section (matching filtered/sorted on-screen rows).
  - `components/figma/services-report-table.tsx`: Added `Summary` worksheet with per-section totals and a grand total row (`Rows`, `Payments`, `Jobs`, `Sum`, `Accrual`, `Order`, `Payment`, `Due`, `Balance`).
- Commit: 78cb5dd
- URL: https://ice-o5i8qhuxe-iceerp.vercel.app

## 2026-03-20 (86)
- Summary: Services Report payment IDs now include quick shortcut links that open Payments table pre-filtered by selected payment ID.
- Changes:
  - `components/figma/services-report-table.tsx`: Payment IDs column now renders each `paymentId` with an `ArrowUpRight` shortcut to `/dictionaries/payments?paymentId=...`.
  - `components/figma/payments-table.tsx`: Reads `paymentId` from URL query params on load and applies it to table search state.
- Commit: 275561c
- URL: https://ice-nn7zf7xik-iceerp.vercel.app

## 2026-03-19 (85)
- Summary: Services Report now highlights `Sum` in bold red when it mismatches last-month accrual or last-month order.
- Changes:
  - `app/api/services-report/route.ts`: Added previous-month ledger aggregates per payment (`last_month_accrual`, `last_month_order`) and returned them in row payload.
  - `components/figma/services-report-table.tsx`: Added `lastMonthAccrual`/`lastMonthOrder` to row model and styled `Sum` cell as `font-bold text-red-600` when `sum != lastMonthAccrual || sum != lastMonthOrder` (with small numeric tolerance).
- Commit: d4a440d
- URL: https://ice-8xor6xn16-iceerp.vercel.app

## 2026-03-19 (84)
- Summary: Fixed Services Report job-link binding persistence (save was failing silently in some cases).
- Changes:
  - `app/api/job-projects/route.ts`: Added UUID validation/normalization for `projectUuid` and `jobUuids`, deduped job UUIDs, and wrapped delete+insert in a transaction.
  - `components/figma/services-report-table.tsx`: Filtered invalid job UUIDs before submit, enforced `response.ok` check with surfaced API error, and awaited report refresh after save.
- Commit: 8f9d392
- URL: https://ice-ag0z65pdu-iceerp.vercel.app

## 2026-03-19 (83)
- Summary: Counteragent Statement corrected to keep `CA Account` unchanged and add separate `Account` column from bank accounts.
- Changes:
  - `app/api/counteragent-statement/route.ts`: `accountLabel` now formats as `accountNumber + currency` (e.g., `GE65...GEL`).
  - `app/counteragent-statement/[counteragentUuid]/page.tsx`: Restored `CA Account` to `counteragentAccountNumber`, added new `Account` column using `accountLabel` from bank accounts.
- Commit: a3089f2
- URL: https://ice-fw0fkx7lo-iceerp.vercel.app

## 2026-03-19 (82)
- Summary: Counteragent Statement now shows bank account from `bank_accounts` in `accountNumber_currency` format.
- Changes:
  - `app/api/counteragent-statement/route.ts`: Formatted `accountLabel` as `${bank_account_number}_${account_currency_code}` (trimmed fallbacks).
  - `app/counteragent-statement/[counteragentUuid]/page.tsx`: Prioritized `accountLabel` over `counteragentAccountNumber` in statement rows.
- Commit: a18444b
- URL: https://ice-j77dqoe8i-iceerp.vercel.app

## 2026-03-19 (84)
- Summary: Fixed missing historical TBC transactions in the main Bank Transactions page by including new TBC source tables and ensuring "all" limit is applied explicitly.
- Changes:
  - Updated `app/api/bank-transactions/route.ts` `SOURCE_TABLES` to include:
    - `GE39TB7856036150100001_TBC_USD`
    - `GE39TB7856036150100001_TBC_EUR`
    - `GE79TB7856045067800004_TBC_GEL`
    - `GE52TB7856045067800005_TBC_GEL`
  - Updated `app/dictionaries/bank-transactions/BankTransactionsTableFigma.tsx` to default record limit to `all` and send `limit=0` when `all` is selected.
  - Updated clear-filters behavior in `BankTransactionsTableFigma.tsx` to reset limit back to `all`.
- Commit: 689dbfc
- URL: https://ice-3lwa57hnz-iceerp.vercel.app

## 2026-03-19 (83)
- Summary: Bank Transactions Test now defaults to loading all records, preventing GEL TBC rows from being paginated out by the default first-page limit.
- Changes:
  - Updated `app/dictionaries/bank-transactions-test/BankTransactionsTestTableFigma.tsx` to default `recordLimitInput` and `appliedRecordLimit` to `all`.
  - Updated localStorage fallback values for record limit keys (`bankTransactionsTest_recordLimit`, `bankTransactionsTest_appliedRecordLimit`) to `all`.
- Commit: 0a62a04
- URL: https://ice-d3aiw6z3p-iceerp.vercel.app

## 2026-03-19 (82)
- Summary: Bank Transactions Test API now includes newly imported TBC deconsolidated tables so those records are visible in the Test UI.
- Changes:
  - Updated `app/api/bank-transactions-test/route.ts` `SOURCE_TABLES` to include:
    - `GE39TB7856036150100001_TBC_USD`
    - `GE39TB7856036150100001_TBC_EUR`
    - `GE79TB7856045067800004_TBC_GEL`
    - `GE52TB7856045067800005_TBC_GEL`
  - Added unique synthetic ID offsets for the new TBC sources to avoid collisions in combined result sets.
- Commit: 9d506da
- URL: https://ice-jyfsdnbac-iceerp.vercel.app

## 2026-03-19 (81)
- Summary: Added per-column sorting and filtering to Services Report grid, aligned with Payments Report-style column controls.
- Changes:
  - `components/figma/services-report-table.tsx`: Added sortable headers with sort icons, per-column `ColumnFilterPopover` controls, advanced filter support by column format, and clear-filters action.
  - `components/figma/services-report-table.tsx`: Added filtering pipeline (`FilterState` + `matchesFilter`) and sorting pipeline on report rows before section grouping.
  - `components/figma/services-report-table.tsx`: Preserved formatted date display while sorting/filtering on raw date values.
- Commit: 7ac6d71
- URL: https://ice-gxxmjpa6l-iceerp.vercel.app

## 2026-03-19 (80)
- Summary: Services Report now includes Project Service State and a project shortcut in the Project column.
- Changes:
  - `app/api/services-report/route.ts`: Added `service_state` from `projects` to selected payments and final grouped response as `serviceState`.
  - `components/figma/services-report-table.tsx`: Added `Service State` column to the grid, included it in search, and added project shortcut icon in Project column linking to `/admin/projects?projectUuid=...`.
  - `components/figma/services-report-table.tsx`: Bumped per-section column storage key to V5 to include new column defaults.
- Commit: 6d2bc3a
- URL: https://ice-bqg9ekn4h-iceerp.vercel.app

## 2026-03-19 (79)
- Summary: Fixed empty preselection in Services Report job-linking dialog for legacy elevator links.
- Changes:
  - `app/api/job-projects/route.ts`: GET now falls back to legacy `jobs.project_uuid` links in addition to `job_projects`.
  - `components/figma/services-report-table.tsx`: Dialog loader now also merges current payment-assigned `jobUuid` values into preselected set.
- Commit: 2c8a079
- URL: https://ice-ee2j07hx1-iceerp.vercel.app

## 2026-03-19 (78)
- Summary: Added `address` field to Projects table and add/edit forms.
- Changes:
  - `prisma/schema.prisma`: Added optional `address` column to `projects` model.
  - `scripts/add-projects-address-column.js`: DB script to add `projects.address` column if missing.
  - `app/api/projects/route.ts`: Added `address` handling to project create and update endpoints.
  - `components/figma/projects-table.tsx`: Added Address column in projects table, add/edit address inputs in forms, and address mapping/search/payload support.
  - `app/admin/projects/page.tsx`: Added `address` mapping to Project DTO.
  - `app/dictionaries/projects/ProjectsClientPage.tsx`: Added `address` mapping to Project DTO.
- Commit: e2a545a
- URL: https://ice-ozukwzvs5-iceerp.vercel.app

## 2026-03-19 (77)
- Summary: Full-screen job-linking dialog with search/filter/checkboxes/select-all and many-to-many job-project binding via new `job_projects` junction table.
- Changes:
  - `prisma/schema.prisma`: Added `job_projects` model (job_uuid + project_uuid junction table with unique constraint).
  - `scripts/create-job-projects-table.js`: Migration script — creates `job_projects` table, indexes, and backfills 520 rows from existing `jobs.project_uuid`.
  - `app/api/job-projects/route.ts`: New API endpoint — GET returns linked job UUIDs for a project, POST bulk-saves job-project links (replace-all strategy).
  - `app/api/services-report/route.ts`: Jobs count now uses `job_projects` table (correlated subquery) instead of `COUNT(DISTINCT sp.job_uuid)` from payments. Job names also sourced from `job_projects`.
  - `components/figma/services-report-table.tsx`: Dialog redesigned to 95vw x 95vh full-screen. Shows ALL jobs in a searchable table with columns (checkbox, name, project, brand, floors, weight, FF, active). Select-all for filtered results. Bulk bind/unbind jobs to the row's project. Removed Combobox dependency.
- Commit: e4514e9
- URL: https://ice-o73hgufjv-iceerp.vercel.app

## 2026-03-19 (76)
- Summary: Services Report job-linking feature — Link2 icon in Jobs column opens dialog to bind jobs to payment IDs. Jobs count now reflects only bound jobs.
- Changes:
  - `app/api/services-report/route.ts`: Changed jobs_count to COUNT(DISTINCT sp.job_uuid) from payment records. Added job_names array via ARRAY_AGG. Removed jobs_per_project CTE.
  - `app/api/payments/route.ts`: Added paymentIds query parameter filter to GET endpoint for fetching specific payments by payment_id.
  - `components/figma/services-report-table.tsx`: Added Link2 icon button next to jobs count in Jobs column. Added job-linking dialog modal with Combobox selectors per payment ID. Dialog loads project jobs and current assignments, saves via PATCH to payments API. Added JobOption and JobLinkDialogState types.
- Commit: a0cd501
- URL: https://ice-npre6v9tv-iceerp.vercel.app

## 2026-03-19 (75)
- Summary: Services Report grid enhancements — accrual column, colored financial columns, confirmation checkbox with conditional row formatting, dd.mm.yyyy dates. Reverted misapplied Payment Statement styling.
- Changes:
  - `components/figma/services-report-table.tsx`: Added Accrual column to grid. Accrual (#ffebee), Order (#fff9e6), Payment (#e8f5e9) background colors on headers and data cells. Confirmed column renders as disabled Checkbox. Rows with confirmed+due>0 highlighted green, confirmed+due=0 highlighted gray. Latest Date now uses dd.mm.yyyy format. Storage key bumped to V4.
  - `app/payment-statement/[paymentId]/page.tsx`: Reverted deployment 74 changes (column colors, header totals, checkbox, conditional formatting) — those belong to Services Report only.
- Commit: 5a2a7a5
- URL: https://ice-28x4qmykx-iceerp.vercel.app

## 2026-03-19 (74)
- Summary: Payment Statement UI enhancements — accrual/order/payment totals in header, column background colors matching Payments Report, confirmation checkbox with conditional row highlighting, dd.mm.yyyy date format.
- Changes:
  - `app/payment-statement/[paymentId]/page.tsx`: Added total Accrual/Order/Payment summary cards in Payment Info header with matching colors. Accrual (#ffebee), Payment (#e8f5e9), Order (#fff9e6) column backgrounds on headers, data cells, and totals row. Confirmed column now renders as disabled Checkbox instead of Yes/No text. Rows with confirmed+due>0 highlighted green, confirmed+due=0 highlighted gray. CreatedAt date format changed from dd.mm.yyyy HH:MM:SS to dd.mm.yyyy.
- Commit: c07d34e
- URL: https://ice-4st07aiog-iceerp.vercel.app

## 2026-03-19 (73)
- Summary: Payment Statement now uses income-aware due/balance formulas based on financial code `is_income` flag; Services Report Payment IDs column is text-only with statement icons only in Actions.
- Changes:
  - `app/api/payment-statement/route.ts`: Added `fc.is_income` to payment and salary_accruals SQL queries; exposed `isIncome` boolean in API response.
  - `app/payment-statement/[paymentId]/page.tsx`: For expense codes (`isIncome=false`), uses `Math.abs(payment)` for cumulative paid; for income codes (`isIncome=true`), uses raw payment value so refunds/reversals naturally decrease cumulative paid.
  - `components/figma/services-report-table.tsx`: Moved FileText statement icons from Payment IDs column into Actions column; Payment IDs now text-only.
- Commit: bcf9eee
- URL: https://ice-q7u60yjmd-iceerp.vercel.app

## 2026-03-19 (72)
- Summary: Fixed Services Report column selector to expose all columns including Payment IDs as own column; fixed Payment Statement due/balance sign logic for income payment IDs.
- Changes:
  - Updated `components/figma/services-report-table.tsx`: Payment IDs is now a separate column with statement icons; Actions column contains only counteragent icon; all columns (including Actions) are selectable from Columns button; removed column exclusion filter; bumped storage key to V3.
  - Updated `app/payment-statement/[paymentId]/page.tsx`: replaced signed cumulative payment with absolute magnitude for due/balance/paidPercent so formulas work correctly for both expense (outgoing) and income (incoming) payment IDs.
- Commit: b866ed1
- URL: https://ice-1q11nzld7-iceerp.vercel.app

## 2026-03-19 (71)
- Summary: Restored BOG daily cron imports by adding missing production BOG credentials.
- Changes:
  - Added `BOG_CREDENTIALS_MAP` to Vercel Production environment variables.
  - Triggered one manual production redeploy so API/cron functions load new credentials.
  - Verified `/api/cron/bog-import-last-3-days` executes and imports records when called with cron headers.
- Commit: 60c9b5c
- URL: https://ice-cxj2wrh8b-iceerp.vercel.app

## 2026-03-18 (70)
- Summary: Moved Services Report payment/counteragent statement controls into Actions and matched Payments Report red warning icon behavior.
- Changes:
  - Updated `components/figma/services-report-table.tsx` to move payment IDs + statement icons and counteragent statement icon into an `Actions` column.
  - Updated `components/figma/services-report-table.tsx` so counteragent `User` icon turns red for warning state, matching Payments Report styling and tooltip behavior.
  - Updated `app/api/services-report/route.ts` to return `hasUnboundCounteragentTransactions` based on unbound raw transactions (`payment_id IS NULL/empty`, excluding batched records).
- Commit: 3a646be
- URL: https://ice-hmttxvs1l-iceerp.vercel.app

## 2026-03-18 (69)
- Summary: Updated Services Report statement actions to match Payments Report icon-style controls.
- Changes:
  - Updated `components/figma/services-report-table.tsx` to replace text links with `FileText` icon buttons for payment statements.
  - Updated `components/figma/services-report-table.tsx` to replace text "Open" link with `User` icon button for counteragent statement.
  - Kept disabled/non-clickable state styling for rows without `counteragentUuid`, aligned with Payments Report behavior.
- Commit: e7370fa
- URL: https://ice-j00a2t9ke-iceerp.vercel.app

## 2026-03-18 (68)
- Summary: Ensured Services Report shows new statement columns for existing users by resetting persisted section-column layout version.
- Changes:
  - Updated `components/figma/services-report-table.tsx` localStorage key from `servicesReportSectionColumnsV1` to `servicesReportSectionColumnsV2`.
  - Forces fresh default columns so `Payment IDs / Statements` and `Counteragent Statement` are visible even when users have old saved column settings.
- Commit: 80524b0
- URL: https://ice-1j24mavv7-iceerp.vercel.app

## 2026-03-18 (67)
- Summary: Restored Services Report rows for selected financial codes by fixing UUID aggregation in grouped SQL.
- Changes:
  - Updated `app/api/services-report/route.ts` to replace unsupported `MIN(sp.counteragent_uuid)` with `MAX(sp.counteragent_uuid::text)` when deriving single counteragent per grouped row.
  - Fixes runtime SQL error (`function min(uuid) does not exist`) that caused Services Report API to return no rows.
- Commit: 2458f59
- URL: https://ice-d3k204hl1-iceerp.vercel.app

## 2026-03-18 (66)
- Summary: Extended Services Report with project-level payment IDs and direct statement navigation links.
- Changes:
  - Updated `app/api/services-report/route.ts` to return `paymentIds` (distinct aggregated payment IDs per grouped project row).
  - Updated `app/api/services-report/route.ts` to return grouped `counteragentUuid` when a single counteragent is present for the row.
  - Updated `components/figma/services-report-table.tsx` to add `Payment IDs / Statements` column with clickable links to `/payment-statement/{paymentId}`.
  - Updated `components/figma/services-report-table.tsx` to add `Counteragent Statement` column with direct link to `/counteragent-statement/{counteragentUuid}`.
- Commit: 991e071
- URL: https://ice-fk7n9o9ry-iceerp.vercel.app

## 2026-03-17 (65)
- Summary: Added automatic provisioning for missing TBC XML accounts so imports can create required account metadata, parsing-scheme mapping, and deconsolidated tables on demand.
- Changes:
  - Added `lib/bank-import/tbc-provisioning.ts` to provision missing TBC account infrastructure: ensure `TBC_<CCY>` parsing scheme, create/update `bank_accounts` mapping (`bank_uuid`, `parsing_scheme_uuid`, `raw_table_name`), and create missing `%_TBC_%` table by cloning an existing TBC table structure.
  - Updated `app/api/bank-transactions/upload/route.ts` to auto-provision TBC account infrastructure when a TBC XML account is not found in `bank_accounts`, then continue import.
  - Updated `app/api/bank-transactions-test/upload/route.ts` with the same auto-provisioning behavior.
  - Added migration `prisma/migrations/20260317102000_provision_missing_tbc_accounts_from_xml/migration.sql` to pre-provision accounts/tables discovered from `TBC Missing Accounts` XMLs.
- Commit: 3656213
- URL: https://ice-bdntx5j4a-iceerp.vercel.app

## 2026-03-17 (64)
- Summary: Expanded BOG conversion detection to capture conversion-like rows where per-row metadata shows same source/destination currency.
- Changes:
  - Updated `lib/bank-import/import_bank_xml_data_deconsolidated.ts` to admit conversion candidates when conversion-like text is present (`DocNomination`/`DocInformation`), even if `DocSrcCcy == DocDstCcy` on the row.
  - Added fallback amount inference from paired row signs (`account_currency_amount`) when `DocSrc/DocDst` currency mapping is insufficient.
  - Updated `scripts/backfill-conversions.ts` with aligned fallback logic and candidate selection criteria for historical reprocessing consistency.
- Commit: fe4ad49
- URL: https://ice-d79r1q4cy-iceerp.vercel.app

## 2026-03-17 (63)
- Summary: Fixed BOG conversion casting for one-sided FX rows (missing external counterpart account/row) so conversions are still created and linked.
- Changes:
  - Updated `lib/bank-import/import_bank_xml_data_deconsolidated.ts` conversion step to infer counterpart internal account from the same base account + opposite FX currency when one Doc account is external/missing.
  - Added one-sided conversion handling: create conversion and upsert conversion entries when at least one side row exists, instead of requiring both deconsolidated rows.
  - Updated `scripts/backfill-conversions.ts` with the same fallback/inference and one-sided linking behavior for reprocessing historical data.
- Commit: 2273a35
- URL: https://ice-oflda4srg-iceerp.vercel.app

## 2026-03-17 (62)
- Summary: Hardened BOG cron import authorization/runtime behavior and aligned conversion backfill data model with conversion entries + API balance fields.
- Changes:
  - Updated `app/api/cron/bog-import-last-3-days/route.ts` with extended runtime (`maxDuration = 300`), 3-day lookback defaults, stronger Vercel/secret auth checks, and unauthorized diagnostics hints.
  - Updated `scripts/backfill-conversions.ts` to include `entriesid`/`insider_uuid` handling and upsert `conversion_entries` (`OUT`/`FEE`/`IN`) for each linked conversion.
  - Updated `prisma/schema.prisma` with optional bank-API mirror fields on `BankAccountBalance` (`openingBalanceBankApi`, `inflowBankApi`, `outflowBankApi`, `closingBalanceBankApi`).
- Commit: f55742d
- URL: https://ice-n7lo2wqb6-iceerp.vercel.app

## 2026-03-16 (61)
- Summary: Fixed TBC/BOG deconsolidated import failures caused by `tmp_turnovers` temp-table collisions in balance recompute triggers.
- Changes:
  - Updated `lib/bank-import/import_bank_xml_data.ts` to detect Postgres `42P07` `tmp_turnovers already exists` during batch insert and retry row-by-row for that batch.
  - Added migration `prisma/migrations/20260316193000_fix_tmp_turnovers_conflict/migration.sql` to make `recompute_bank_account_balance_periods` temp-table handling re-entrant (`CREATE TEMP TABLE IF NOT EXISTS` + `TRUNCATE`).
  - Preserves normal batch insert path for all non-conflict errors.
- Commit: 62b343c
- URL: https://ice-ozushicyh-iceerp.vercel.app

## 2026-03-16 (60)
- Summary: Added optional API debug instrumentation for bank transactions to trace row counts and samples across processing stages.
- Changes:
  - Updated app/api/bank-transactions/route.ts to accept debug=1 (or debug=true) and include a debug object in responses.
  - Added stage counters (sqlRows, dateFilteredRows, mappedRows, conversionRows, balanceRows, combinedRows) for faster mismatch triage.
  - Added JSON-safe sample rows for raw SQL, filtered, mapped, conversion, and combined outputs (with bigint-safe serialization).
  - Included debug payload in both normal and ids response branches.
- Commit: 743ff33
- URL: https://ice-brc0gm0pm-iceerp.vercel.app

## 2026-03-16 (59)
- Summary: Normalized conversion transaction date fields in bank-transactions APIs to ISO `YYYY-MM-DD` for clean side-by-side comparison with ordinary transactions.
- Changes:
  - Updated `app/api/bank-transactions/route.ts` to normalize conversion `transaction_date` and `correction_date` with existing `toComparableDate` before response serialization.
  - Updated `app/api/bank-transactions-test/route.ts` with the same normalization logic to keep test endpoint behavior aligned.
  - No changes to underlying stored values; this deploy standardizes API output format only.
- Commit: 07c0e5b
- URL: https://ice-qnk461iuv-iceerp.vercel.app
## 2026-03-16 (58)
- Summary: Fixed bank-account balance drift miscalculation caused by non-ISO `balance_date` parsing in balance-check API.
- Changes:
  - Updated `app/api/bank-accounts/balance-check/route.ts` to normalize `balance_date` values to `YYYY-MM-DD` before turnover-range filtering.
  - Prevents fallback to full-history sum when `balance_date` arrives as a JS `Date` string (for example `Mon Mar 16 ...`).
  - Eliminates double-counting that produced inflated `computedCurrentBalance` and false `deltaFromStored` drift.
- Commit: 93b1744
- URL: https://ice-1ofal9bk5-iceerp.vercel.app

## 2026-03-15 (57)
- Summary: Deployed latest undeployed updates for testing, including bank account period-balance APIs/UI and integration route additions.
- Changes:
  - Added Bank Accounts balance APIs: `app/api/bank-accounts/balance-check/route.ts` and `app/api/bank-accounts/daily-balances/route.ts`.
  - Updated `app/api/bank-accounts/route.ts` and `components/figma/bank-accounts-table.tsx` with latest-date/recorded-balance support and in-page opening/closing balance query dialog.
  - Included related app/integration updates in this release (`openclaw`, `tbc-id`, `whatsapp`, and supporting Prisma/script changes).
- Commit: 8568cad
- URL: https://ice-2is5r47am-iceerp.vercel.app

## 2026-03-14 (56)
- Summary: Hardened BOG statement import/cron flow so accounts with no records are treated as successful zero-row checks instead of failures.
- Changes:
  - Updated `lib/integrations/bog/statement-mapper.ts` to support `allowEmptyStatement` and return valid empty statement XML with `detailsCount=0`.
  - Updated `app/api/integrations/bog/statements/route.ts` to enable empty-statement mode and skip deconsolidated import when `detailsCount=0`.
  - Updated `app/api/cron/bog-import-last-3-days/route.ts` to treat empty statements as successful account processing (`noTransactions=true`) while continuing normal imports for non-empty statements.
  - Updated deployment policy in `AGENTS.md` to enforce single manual production deployment using `"[skip ci]"` pushes to avoid extra Vercel auto-deploys.
- Commit: acec041
- URL: https://ice-hdfivy5ht-iceerp.vercel.app

## 2026-03-13 (55)
- Summary: Fixed TBC XML import table resolution to use configured/existing deconsolidated tables and avoid hard-failing on missing currency-specific table names.
- Changes:
  - Updated `lib/bank-import/import_bank_xml_data.ts` to resolve TBC target table from existing candidates in priority order: `raw_table_name`, `${account}_TBC_${currency}`, then `${account}_TBC_GEL`.
  - Added explicit existing-table probe logic and clearer error when no TBC table candidate is found.
  - Updated `app/api/bank-transactions/upload/route.ts` and `app/api/bank-transactions-test/upload/route.ts` to replace obsolete `tbc_gel_raw_*` fallback with TBC deconsolidated naming fallback.
- Commit: bc9a4ad
- URL: https://ice-m74mndg7a-iceerp.vercel.app

## 2026-03-13 (54)
- Summary: Added direct counteragent statement gateway action to each row in Projects table.
- Changes:
  - Updated `components/figma/projects-table.tsx` to add an `ArrowUpRight` action button in the Actions column.
  - Button opens `/counteragent-statement/{counteragentUuid}` in a new tab and is disabled when `counteragentUuid` is missing.
  - Expanded Actions column width to accommodate the additional control.
- Commit: d899670
- URL: https://ice-gz0qdvr35-iceerp.vercel.app

## 2026-03-13 (53)
- Summary: Fixed production ledger insert/update/upsert failures caused by missing `payments_ledger.insider_uuid` after insider trigger removal.
- Changes:
  - Updated `app/api/payments-ledger/route.ts` to resolve `insider_uuid` from `payments` before insert and persist it on new ledger rows.
  - Updated `app/api/payments-ledger/[id]/route.ts` to validate payment insider mapping and update `payments_ledger.insider_uuid` on ledger edits.
  - Updated `app/api/payments-ledger/bulk/route.ts` to preload paymentâ†’insider mappings, validate missing insider cases, and include `insider_uuid` in bulk inserts.
  - Updated `app/api/cron/cash-based-monthly-accruals/route.ts` to include `insider_uuid` in monthly ledger upserts.
- Commit: e9a5d73
- URL: https://ice-g9v5x55gq-iceerp.vercel.app

## 2026-03-13 (52)
- Summary: Standardized Projects date handling so DB date values stay canonical while UI display and sorting remain consistent in `dd.mm.yyyy`.
- Changes:
  - Updated `components/figma/projects-table.tsx` with unified date helpers for parsing, display formatting, and edit-form input conversion across `date`, `createdAt`, and `updatedAt`.
  - Fixed Projects table sorting to use robust date parsing for mixed `YYYY-MM-DD` and `DD.MM.YYYY` inputs.
  - Updated `app/api/projects-v2/route.ts` to return `p.date` directly (removed `TO_CHAR(...)`) so API preserves DB date values and UI handles formatting.
  - Updated `app/admin/projects/page.tsx` mapper comment to match canonical API date behavior.
- Commit: 360e4ca
- URL: https://ice-lc6cfndfn-iceerp.vercel.app

## 2026-03-13 (51)
- Summary: Generalized TBC XML import processing to support currency-aware deconsolidated targets (including FX).
- Changes:
  - Updated `lib/bank-import/import_bank_xml_data.ts` to introduce `processTBC(...)` with currency-aware table naming (`${accountNumber}_TBC_${currencyCode}`) and retained `processTBCGEL(...)` as a backward-compatible wrapper.
  - Updated `app/api/bank-transactions/upload/route.ts` and `app/api/bank-transactions-test/upload/route.ts` to call `processTBC(...)` for TBC uploads.
  - Updated `scripts/test-tbc-import.ts` to use `processTBC(...)`.
- Commit: d5f93a0
- URL: https://ice-r8sqpn9ji-iceerp.vercel.app

## 2026-03-13 (50)
- Summary: Corrected Payment ID Statement due and balance formulas to respect signed bank transaction direction.
- Changes:
  - Updated `app/payment-statement/[paymentId]/page.tsx` to keep bank transaction sign in `payment`/`ppc` values and normalize magnitude from nominal/account amounts.
  - Reworked cumulative calculations so `due` and `balance` are computed with signed cumulative payment totals, while `paidPercent` uses paid magnitude.
- Commit: 6aecc24
- URL: https://ice-2427e8mu1-iceerp.vercel.app

## 2026-03-13 (49)
- Summary: Aligned Projects insider filtering and labeling strictly to `projects.insider_uuid`.
- Changes:
  - Updated `app/api/projects/route.ts` to use `projects.insider_uuid` directly for insider join and insider selection filtering.
  - Removed counteragent-insider fallback from Projects list/single GET paths to match authoritative project binding.
- Commit: 3ed2137
- URL: https://ice-l1k0jrex8-iceerp.vercel.app

## 2026-03-13 (48)
- Summary: Restored Projects insider-name rendering and multi-insider header context.
- Changes:
  - Updated `app/api/projects/route.ts` to strengthen insider-name fallback (`insider_name` now falls back to effective insider UUID text when label rows are missing) and to expose fallback `insider_uuid` from effective insider context.
  - Updated `components/figma/projects-table.tsx` header badge to display all currently selected insiders from `/api/insider-selection` (plural-aware), replacing the legacy single-insider required badge in Projects.
- Commit: 8103334
- URL: https://ice-kcjxym4hm-iceerp.vercel.app

## 2026-03-13 (47)
- Summary: Fixed Projects insider visibility fallback and corrected date sorting behavior.
- Changes:
  - Updated `app/api/projects/route.ts` to use `COALESCE(projects.insider_uuid, counteragents.insider_uuid)` for insider filtering and insider-name join fallback, restoring visibility for mixed legacy/new insider bindings.
  - Updated `components/figma/projects-table.tsx` sorting logic to treat `date`, `createdAt`, and `updatedAt` as real dates (timestamp comparison) instead of plain text.
- Commit: 58f40f2
- URL: https://ice-e1m82xbqg-iceerp.vercel.app

## 2026-03-13 (46)
- Summary: Fixed Projects insider visibility for multi-insider mode by removing legacy single-insider DB trigger binding.
- Changes:
  - Updated `app/api/projects/route.ts` insider joins to resolve insider label/flag from `projects.insider_uuid` instead of counteragent-linked insider fallback.
  - Added migration `prisma/migrations/20260313183000_remove_single_insider_binding_triggers/migration.sql` to drop `bind_single_required_insider_uuid()` and all `trg_bind_single_insider_*` triggers, including `trg_bind_single_insider_projects`.
  - Preserves explicitly selected insider on insert/update so homepage insider checkbox filtering and Projects table visibility align.
- Commit: a0333a5
- URL: https://ice-a9rmaujpz-iceerp.vercel.app

## 2026-03-13 (45)
- Summary: Updated Projects form Department selector to fixed city options.
- Changes:
  - Updated `components/figma/projects-table.tsx` to use dedicated department options (`Batumi`, `Tbilisi`) in both Add and Edit project dialogs.
  - Corrected department dropdown source so it no longer reuses service-state values.
- Commit: cdae426
- URL: https://ice-apzq87iom-iceerp.vercel.app

## 2026-03-13 (44)
- Summary: Fixed production migration path so insider-constraint changes are actually applied during Vercel deploys.
- Changes:
  - Updated `vercel.json` build command to run `pnpm prisma migrate deploy` before `pnpm build`.
  - Updated `app/api/counteragents/route.ts` to map Prisma `P2002` on `insider` to a clear `409` message indicating pending DB migration state.
  - This deploy runs migration `20260313134000_allow_multiple_insiders` in Vercel build, which drops `uq_single_true_insider`.
- Commit: 61c42ba
- URL: https://ice-bpe0ky0ai-iceerp.vercel.app

## 2026-03-13 (43)
- Summary: Removed single-insider restriction so multiple counteragents can be marked as insiders.
- Changes:
  - Updated `app/api/counteragents/route.ts` to remove POST/PATCH API guards that returned `409` when another `insider=true` row already existed.
  - Added migration `prisma/migrations/20260313134000_allow_multiple_insiders/migration.sql` to drop unique index `uq_single_true_insider`.
- Commit: 20af5cf
- URL: https://ice-ixrdvsgyp-iceerp.vercel.app

## 2026-03-13 (42)
- Summary: Stabilized counteragent creation under insider uniqueness constraints and prevented noisy audit failures for bulk operations.
- Changes:
  - Updated `app/api/counteragents/route.ts` to normalize insider writes as explicit booleans and added clear API guards that return `409` when attempting to create/update a second `insider=true` counteragent.
  - Updated `lib/audit.ts` bigint fallback handling for `AuditLog.record_id`: when `record_id` is non-numeric (for example bulk composite IDs), the audit row is now written with `record_id = NULL` instead of failing on type mismatch.
  - Preserved existing numeric bigint insert fallback for environments where `AuditLog.record_id` remains bigint.
- Commit: 9ec17ff
- URL: https://ice-jpfh4xyjv-iceerp.vercel.app

## 2026-03-13 (41)
- Summary: Deployed BOG deconsolidated import fix to always resolve generic/legacy BOG parsing schemes to currency-specific tables.
- Changes:
  - Updated `lib/bank-import/import_bank_xml_data_deconsolidated.ts` scheme normalization to map generic values (`BOG_FX`, `BOG`, and `BOG_*`) to `defaultSchemeByCurrency(currencyCode)`.
  - Prevents invalid table targeting like `..._BOG_FX` and ensures imports route to existing currency tables such as `..._BOG_GEL`, `..._BOG_USD`, `..._BOG_EUR`, etc.
- Commit: 29b5753
- URL: https://ice-if6l46frg-iceerp.vercel.app

## 2026-03-13 (40)
- Summary: Added automated daily BOG API import cron to fetch the last 3 days and process through the deconsolidated XML pipeline.
- Changes:
  - Added new cron endpoint `app/api/cron/bog-import-last-3-days/route.ts`.
  - The cron resolves BOG accounts from `bank_accounts`, fetches `/statement/{account}/{currency}/{start}/{end}`, maps API payload to XML-compatible format, and calls `processBOGGELDeconsolidated`.
  - Added optional account scoping via `BOG_CRON_ACCOUNT_UUIDS` env var and insider fallback from `BOG_CREDENTIALS_MAP` when exactly one insider is configured.
  - Updated `vercel.json` cron schedule with `/api/cron/bog-import-last-3-days` at `0 3 * * *` (07:00 Tbilisi).
  - Updated BOG statement mapper ID mapping to accept official fields `DocumentKey` and `EntryId` for strict import validation.
- Commit: a2c629f
- URL: https://ice-2r95zbsx0-iceerp.vercel.app

## 2026-03-12 (39)
- Summary: Added stable automatic rebinding of deconsolidated rows when counteragents are created or updated.
- Changes:
  - Updated `app/api/counteragents/route.ts` to trigger automatic reparse-by-INN after `POST` and `PATCH` so matching deconsolidated rows bind to newly available counteragents.
  - Added `reparseByCounteragentInn` in `lib/bank-import/reparse.ts` and wired INN normalization (`10-digit` and `0`-prefixed variants).
  - Reparse table selection is now dynamic via `information_schema` discovery of BOG/TBC deconsolidated tables, with fallback defaults for safety.
- Commit: 1562e2d
- URL: https://ice-p58qvec2n-iceerp.vercel.app

## 2026-03-12 (38)
- Summary: Hardened `BOG_CREDENTIALS_MAP` environment parsing for deployment-platform formatting differences.
- Changes:
  - Updated `lib/integrations/bog/client.ts` to normalize quoted JSON env values before parsing.
  - Added fallback parsing for escaped-quote JSON strings used by some environment dashboards.
  - Preserved existing uppercase/camelCase credential key support and insider-scoped credential selection behavior.
- Commit: 291eb34
- URL: https://ice-621s6eeqv-iceerp.vercel.app

## 2026-03-11 (37)
- Summary: Enforced strict BOG statement key integrity so imports accept only real `DocKey` and `EntriesId` values.
- Changes:
  - Updated `lib/integrations/bog/statement-mapper.ts` to remove synthetic key fallbacks (`API_DOC_*` and index-based `EntriesId`) and require explicit source keys.
  - Mapper now throws validation errors when either `DocKey` or `EntriesId` is missing in any transaction row.
  - Updated `/api/integrations/bog/statements` to return `422` for missing-key validation failures instead of silently generating synthetic IDs.
- Commit: 33a90d6
- URL: https://ice-mbilxpfco-iceerp.vercel.app

## 2026-03-11 (36)
- Summary: Deployed BOG integration credential-map support for insider-specific authentication using JSON env mapping.
- Changes:
  - Updated BOG client to parse `BOG_CREDENTIALS_MAP` and support both uppercase (`INSIDER_UUID`, `BOG_CLIENT_ID`, `BOG_CLIENT_SECRET`) and camelCase key variants.
  - Added insider-scoped token caching and insider-aware token/request execution (`insiderUuid`) with legacy single-credential fallback preserved.
  - Updated BOG statement/test API routes to accept/use `insiderUuid` and derive insider context from `bank_accounts.insider_uuid` during import flow.
  - Updated `.env.example` to document preferred multi-insider `BOG_CREDENTIALS_MAP` format.
- Commit: a71da0e
- URL: https://ice-59aohujkg-iceerp.vercel.app

## 2026-03-11 (35)
- Summary: Deployed combined insider-selection rollout across forms/APIs and Bank of Georgia integration endpoints/libs, including latest parallel-session updates.
- Changes:
  - Added insider-selection API and shared selection resolver utilities with cookie-backed selection handling (`/api/insider-selection`, `lib/insider-selection.ts`).
  - Enforced single-insider lock and multi-insider selection behavior across Projects, Jobs, Payments, Bank Accounts, and Salary Accruals UI/API flows.
  - Added BOG integration endpoints for smoke test and statement import pipeline mapping (`/api/integrations/bog/test`, `/api/integrations/bog/statements`).
  - Added BOG integration client + statement mapper libraries (`lib/integrations/bog/client.ts`, `lib/integrations/bog/statement-mapper.ts`) and associated supporting artifacts included in this deployment commit.
- Commit: 28eb878
- URL: https://ice-xg629zw1b-iceerp.vercel.app

## 2026-03-11 (34)
- Summary: Added Insider name columns across required table UIs, introduced shared required-insider name hook, and stabilized build lint warnings for deployment.
- Changes:
  - Added shared hook `components/figma/shared/use-required-insider.ts` and wired insider-name display into required table UIs (bank accounts, jobs, projects, payments, payments ledger, salary accruals, waybills, conversions).
  - Updated counteragents table insider labeling (`Is Insider` + `Insider`) and refreshed related table column configs/keys where needed.
  - Updated deployment policy in `AGENTS.md` to require strict order: local production build, then commit/push, then deploy.
  - Applied targeted lint-warning suppressions in hook-heavy table components and image fallback components to keep production build clean.
- Commit: 0460c10
- URL: https://ice-lalj72rj5-iceerp.vercel.app

## 2026-03-11 (33)
- Summary: Persisted `insider_name` physically in `counteragents` and wired API writes to keep it in sync.
- Changes:
  - Added migration `prisma/migrations/20260311103000_add_counteragents_insider_name/migration.sql` to add `counteragents.insider_name` and backfill values from linked insider rows and insider self-labels.
  - Updated Prisma model `counteragents` with nullable `insider_name` field.
  - Updated `/api/counteragents` GET/POST/PATCH to select and persist `insider_name` via centralized resolution logic.
- Commit: c33aa82
- URL: https://ice-q5w9xmq24-iceerp.vercel.app

## 2026-03-10 (32)
- Summary: Enforced strict required-insider binding end-to-end with direct-connection migration deploy.
- Changes:
  - Added and applied migration `prisma/migrations/20260310233000_enforce_required_insider_binding/migration.sql` via `DIRECT_DATABASE_URL`; backfilled required tables, enforced `NOT NULL`, installed single-insider binding triggers, and added uniqueness guard for `counteragents.insider=true`.
  - Added required-insider resolver endpoint `/api/required-insider` and shared helper `lib/required-insider.ts`.
  - Added shared UI component `components/figma/shared/required-insider-badge.tsx` and surfaced required insider label across required table pages.
  - Updated required APIs/routes to honor strict insider binding fields for required entities.
- Commit: 92ca169
- URL: https://ice-m9bbaz97m-iceerp.vercel.app

## 2026-03-10 (31)
- Summary: Added `insider_name` display label while keeping `insider_uuid` as the relation key.
- Changes:
  - `/api/counteragents` now enriches responses with derived `insider_name` by resolving `insider_uuid` against counteragents.
  - Counteragents table now includes an `Insider Name` column for interpretation, with UUID still available as the underlying key.
  - Counteragent form wording updated to use `Insider Name` (label) while persisting `insider_uuid` in payload.
- Commit: f89d467
- URL: https://ice-knkle5pwh-iceerp.vercel.app

## 2026-03-10 (30)
- Summary: Fixed mixed-schema audit insert and bank-transactions runtime failures after insider restoration.
- Changes:
  - `lib/audit.ts`: hardened `logAudit` raw insert to support environments where `AuditLog.record_id` is still `bigint` by retrying with `::bigint` cast on `42804` type mismatch.
  - `app/api/bank-transactions/route.ts` and `app/api/bank-transactions-test/route.ts`: replaced broad `include` on `bankAccount.findMany` with explicit `select` to avoid implicit reads of missing columns.
  - Added migration `prisma/migrations/20260310195000_ensure_bank_accounts_insider_uuid/migration.sql` to ensure `bank_accounts.insider_uuid` column/index exist.
  - Applied migration via direct connection (`DIRECT_DATABASE_URL`) before release.
- Commit: a0d2e84
- URL: https://ice-54xh32mu6-iceerp.vercel.app

## 2026-03-10 (29)
- Summary: Restored Counteragents insider support end-to-end and reapplied DB migration via direct connection.
- Changes:
  - Restored `counteragents.insider` and `counteragents.insider_uuid` in Prisma schema and added deployable migration `prisma/migrations/20260310193000_restore_counteragents_insider/migration.sql`.
  - Re-enabled `/api/counteragents` GET/POST/PATCH insider field mapping, select, write, and audit change tracking while preserving explicit PATCH prefetch select safety.
  - Re-enabled Counteragents UI insider controls (toggle + insider owner selector), payload wiring, table columns, and insider option loading.
  - Applied migration using direct DB connection (`DIRECT_DATABASE_URL`) to avoid pooler advisory lock timeouts.
- Commit: 30d7043
- URL: https://ice-nqk25k5mq-iceerp.vercel.app

## 2026-03-10 (28)
- Summary: Removed insider fields from Counteragents end-to-end and fixed production `P2022` on PATCH.
- Changes:
  - Removed `counteragents.insider` and `counteragents.insider_uuid` from Prisma schema and aligned migration scope to keep insider fields only on required core tables.
  - Updated `/api/counteragents` GET/POST/PATCH to stop reading/writing insider fields and removed legacy insider fallback branches.
  - Updated Counteragents UI (table + form + missing-counteragents flow) to remove insider controls/columns and payload fields.
  - Fixed PATCH audit prefetch to use explicit non-insider select (including `entity_type`) so production no longer references removed columns.
- Commits: 9be7312, cc7f99c
- URL: https://ice-qtm4r76yu-iceerp.vercel.app

## 2026-03-10 (27)
- Summary: Hotfix for Counteragents table loading failure after insider rollout.
- Changes:
  - Added defensive fallback logic in `/api/counteragents` for environments where DB insider columns are not yet applied.
  - `GET` now retries with legacy field selection if insider columns are missing.
  - `POST` and `PATCH` now gracefully retry without insider fields on the same schema-mismatch condition.
  - API responses keep stable insider defaults (`insider=false`, `insider_uuid=null`) in fallback mode so UI remains functional.
- Commit: 798cea3
- URL: https://ice-flag8i6u6-iceerp.vercel.app

## 2026-03-10 (26)
- Summary: Released insider foundation for counteragents/core tables and added Signify e-signature trigger integration.
- Changes:
  - Added insider foundation fields in schema and migration: `counteragents.insider`, `counteragents.insider_uuid`, plus `insider_uuid` columns/indexes for core business tables.
  - Extended counteragents API to read/write insider fields end-to-end (create, update, select, and API mapping).
  - Updated Counteragents UI new form flow to manage insider values (toggle + insider owner selector), fetch insider options, and render insider columns.
  - Added Signify integration: reusable client (`lib/signify.ts`) and trigger endpoint (`/api/integrations/signify/send`) for email/mobile document signing flows.
  - Added integration documentation and environment setup guidance for Signify.
- Commit: ae48e7f
- URL: https://ice-2ev9p9o02-iceerp.vercel.app

## 2026-03-10 (25)
- Summary: Payments Report now refreshes in-place without table flicker across all non-initial refresh actions.
- Changes:
  - Added silent refresh mode for report data reloads to keep current rows visible while updated data is fetched.
  - Applied silent refresh to confirm/deconfirm, manual refresh, add-ledger, bulk A/O add, payment edit save, ledger XLSX apply, and cross-tab BroadcastChannel refresh.
  - Initial page load still uses normal loading UX.
- Commit: bb7c105
- URL: https://ice-ffuq204l9-iceerp.vercel.app

## 2026-03-10 (24)
- Summary: Enforced payment deactivation guard when ledger activity exists and excluded inactive payments from report formatting logic.
- Changes:
  - Payments API now blocks activeâ†’inactive updates when non-deleted ledger rows contain non-zero `accrual` or `order` values.
  - API returns explicit `409` conflict with `PAYMENT_HAS_LEDGER_ACTIVITY` for blocked deactivation attempts.
  - Payments table and Payments Report edit flow now show a clear business-rule prompt when deactivation is blocked.
  - Payments Report conditional-format calculations and row highlighting now ignore inactive payments.
- Commit: 89bd297
- URL: https://ice-d00se6jnm-iceerp.vercel.app

## 2026-03-10 (23)
- Summary: Payments Report bank exports now enforce IBAN resolution and BOG export starts from A1.
- Changes:
  - BOG format export removed leading blank row; header/data now begin at `A1`.
  - Added export-time IBAN resolution for both BOG and TBC formats.
  - If counteragent has no IBAN, user is prompted to enter one; value is saved to `counteragents` and used in export.
  - If counteragent has multiple comma-separated IBANs, user is prompted to select which IBAN to export.
  - Payments report API now returns `counteragentRowId` for targeted IBAN persistence during export flow.
- Commit: dfd411d
- URL: https://ice-hwjtng9lz-iceerp.vercel.app

## 2026-03-10 (22)
- Summary: Released batch deassign integrity fixes and local-time Today filter in Payments Report.
- Changes:
  - Batch deassign/delete API now clears stale BTC raw markers only when no partitions remain for the raw record.
  - On deassign cleanup, raw rows now preserve counteragent binding by restoring fallback `counteragent_uuid` when available.
  - Payments Report `Today` date filter now uses local PC timezone date (not UTC) for `maxDate` filtering and confirm/deconfirm max-date operations.
  - Deployment blocker fixes: replaced malformed `prisma.$queryRaw<...>` template usages with typed `prisma.$queryRawUnsafe(...)` in batch delete helpers.
- Commit: a229abf
- URL: https://ice-66te12d1j-iceerp.vercel.app

## 2026-03-09 (21)
- Summary: Payments Report quick-filter links now override saved local filter state.
- Changes:
  - When opening Payments Report with `counteragentUuid`, `projectUuid`, or `jobUuid` URL params, saved filters are cleared first.
  - Quick-filter URL params now produce clean exact filtered views without inheriting previous user-saved filters.
- Commit: 86fa10c
- URL: https://ice-k4oif8jx5-iceerp.vercel.app

## 2026-03-09 (20)
- Summary: Added Payments Report quick filter icons for Project and Job.
- Changes:
  - Added `Filter` icon action next to `Project` value in Payments Report rows.
  - Added `Filter` icon action next to `Job` value in Payments Report rows.
  - Added URL param overrides on load for exact in-view filtering: `projectUuid` and `jobUuid` (matching existing `counteragentUuid` behavior).
- Commit: 89e4ec6
- URL: https://ice-mcl0q8jvg-iceerp.vercel.app

## 2026-03-09 (19)
- Summary: Deployed latest payments fixes for A&O+ validation flow and Add Ledger dialog layout.
- Changes:
  - Payment Statement `+A&O` now submits selected rows via `/api/payments-ledger/bulk` instead of sequential single inserts.
  - Eliminated false intermediate validation failures (`Total order cannot exceed total accrual`) caused by per-row insertion order.
  - Payment Statement now refreshes statement data after successful bulk A&O insert.
  - Payments Report Add Ledger form: moved `Create Entry` button above `Comment` field.
- Commit: 90bb0f5
- URL: https://ice-r5qqx73gh-iceerp.vercel.app

## 2026-03-09 (18)
- Summary: Fixed misleading Payments Report confirm error behavior.
- Changes:
  - Payments confirm API now updates only unconfirmed ledger rows (`confirmed=false`) to avoid re-updating already confirmed entries.
  - Improved constraint error mapping to surface actual DB trigger messages instead of a generic ordered-vs-accrued fallback.
  - Result: confirmation errors now reflect the real validation failure.
- Commit: 865cb72
- URL: https://ice-gh0gqzz5l-iceerp.vercel.app

## 2026-03-09 (17)
- Summary: Added Waybills unidentified-counteragent visual cue and quick add-counteragent flow.
- Changes:
  - Waybills table now highlights rows in light red when `counteragent_uuid` is missing (unidentified counteragent).
  - Added `Add Counteragent` action button in Waybills actions column for unidentified rows.
  - Action opens New Counteragent page with prefilled `name` and `identification_number` from Waybills row data.
  - New Counteragent form now reads query params and auto-prefills Name and ID fields.
- Commit: ff9bd45
- URL: https://ice-l8s7wd8li-iceerp.vercel.app

## 2026-03-09 (16)
- Summary: Improved Waybills filter apply latency.
- Changes:
  - API: Waybills UUID sanitation is now one-time per runtime via guarded execution instead of running on every GET request.
  - UI: Waybills query serialization no longer depends on facet-value state for filter payload generation, avoiding redundant refetch cycles after facet updates.
  - Result: filter apply in Waybills is significantly faster and more immediate.
- Commit: b5be892
- URL: https://ice-go01ou9ya-iceerp.vercel.app

## 2026-03-09 (15)
- Summary: Fixed Waybills Project blank-only filter behavior.
- Changes:
  - Waybills table filter serialization now converts shared blank facet token to actual blank value for API filters.
  - Project column filter in Waybills now correctly returns only null/empty `project_uuid` rows when only `(Blank)` is selected.
- Commit: 84b9d7d
- URL: https://ice-l1hrirqoi-iceerp.vercel.app

## 2026-03-06 (14)
- Summary: Expanded services/projects/jobs features and fixed project mapper typing for successful production build.
- Changes:
  - Services report: removed `payments count`, `financial code`, and `project` from column selector; renamed `Project Name` label to `Project`.
  - Services report: `Sum` now uses project amount from `projects.value` (project table source).
  - Projects: added `department` and `service_state` fields end-to-end (Prisma schema, SQL migration, API, table columns, add/edit dialogs).
  - Jobs: add/edit flows now support binding one job to multiple projects via `projectUuids[]` (API + UI multi-select).
  - Build fix: updated project data mappers in admin and dictionary project pages to include required `department` and `serviceState` fields.
- Commit: 4ac9785
- URL: https://ice-97xhm8g2s-iceerp.vercel.app

## 2026-03-06 (13)
- Summary: Refined Services Report UX to section by financial code and moved financial code selection into Settings.
- Changes:
  - Services report settings now live under a `Settings` button (financial codes no longer permanently visible on-screen).
  - Report details are split into separate sections per selected financial code.
  - Added financial code validation column in section tables.
  - Reworked project presentation into separate columns (`Project`, `Project Name`, `Currency`, `Sum`) instead of combined label.
  - Added per-section table controls similar to Payments Report: column visibility button, column drag-reorder, and column resize.
- Commit: f0e8542
- URL: https://ice-8byydmf3h-iceerp.vercel.app

## 2026-03-06 (12)
- Summary: Added Services Report, tightened confirmation semantics, and restricted salary Bank XLSX export to confirmed selections.
- Changes:
  - New Services Report (`/dictionaries/services-report`) with financial-code-based settings, category summary, totals, and project-level accrual/order/payment/due/balance details.
  - New API (`/api/services-report`) aggregating service-scope data from payments, payments_ledger, projects/jobs, and bank transactions (including batch partition resolution).
  - Payments Report confirmation logic now requires all non-deleted ledger entries to be confirmed (`BOOL_AND`) instead of any entry (`BOOL_OR`).
  - New ledger inserts (single and bulk) now explicitly set `confirmed=false` by default.
  - Salary Accruals `Bank XLSX` export is blocked/disabled when selected rows include unconfirmed payments.
- Commit: c03511e
- URL: https://ice-h4to9d938-iceerp.vercel.app

## 2026-03-06 (11)
- Summary: Added Job Count to Payments Report and fixed Counteragent Statement to show CA account.
- Changes:
  - Payments report API (`/api/payments-report`): added project-level active jobs aggregation (`job_count`) from `jobs` table and returned it as `jobCount`.
  - Payments report table: added visible sortable/filterable `Job Count` numeric column.
  - Counteragent statement page: `CA Account` column now uses counteragent account number as primary source (with safe fallback).
- Commit: f14fc4d
- URL: https://ice-acgmt6moh-iceerp.vercel.app

## 2026-03-06 (10)
- Summary: Fix blank filtering in statement pages so selecting blank values returns matching rows.
- Changes:
  - Counteragent statement page: removed `'-'` fallback coercion in filter input/accessors so null/empty values remain truly blank for matching.
  - Payment statement page: applied the same fix to facet base data, unique values cache, and filter predicate value extraction.
  - Result: blank facet filter now correctly includes rows with null/empty values (e.g. missing `payment_id`) instead of returning no records.
- Commit: 173cff5
- URL: https://ice-h1e5yvlxi-iceerp.vercel.app

## 2026-03-06 (9)
- Summary: Added a shared always-visible "Clear Filters" action across all filter-enabled pages.
- Changes:
  - New shared UI component: `components/figma/shared/clear-filters-button.tsx`.
  - Replaced page-specific clear-filter controls with the shared button across filter-enabled table pages and statement pages.
  - Button is now always visible (disabled when no active filters/search), and clears both column filters and search inputs where applicable.
  - Applied to dictionary bank-transactions pages so date-range clear action remains visible even when inactive.
- Commit: 7a6c338
- URL: https://ice-gmpqidiku-iceerp.vercel.app

## 2026-03-06 (8)
- Summary: Improve filter UX (blank normalization + bank-priority options) and add detailed ledger XLSX upload processing logs in Payments Report.
- Changes:
  - Shared filters: normalized blank facet option into one canonical selectable value so null/empty variants behave consistently in filtering.
  - Shared filter sorting: bank-like options (e.g. Bank, BOG, TBC, Bank of Georgia) are prioritized near the top of value lists.
  - Payments Report ledger XLSX upload: added separate detailed processing log window (popup) during upload/apply, with in-app dialog fallback when popup is blocked.
  - Payments ledger bulk API (`/api/payments-ledger/bulk`): now returns detailed server-side processing logs and success message for log window rendering.
  - Prisma initialization: datasource override is now applied only when DB URL is defined, preventing build-time Prisma initialization crashes.
- Commit: 594ebc4
- URL: https://ice-kchn0crtq-iceerp.vercel.app

## 2026-03-06 (7)
- Summary: Fix missing salary period payment in All Payments report and prevent invisible active filters in Projects table.
- Changes:
  - Salary report API (`/api/salary-report`): missing-period projected rows now prefer real bank `payment_id` values per period instead of only generated IDs.
  - Salary report API (All Payments mode): payment inclusion now also accepts PRL salary-like payment IDs from bank data when accrual and bank IDs differ.
  - Projects table: when any filter is active on a hidden column (e.g. `projectUuid`), that column is auto-shown so filters are visible and removable.
  - Result: March salary payments (e.g. for áƒšáƒáƒ¨áƒ áƒ•áƒ”áƒ áƒ£áƒšáƒ˜áƒ«áƒ”) appear in All Payments view; Projects page no longer looks unfiltered while silently filtered.
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
  - Report table columns: Period, Payment ID, Net Sum (adjusted by pension_scheme Ã—0.98), Surplus Insurance, Ded. Insurance, Ded. Fitness, Ded. Fine, Payment, Month Balance, Cumulative Accrual, Cumulative Payment, Cumulative Balance.
  - Totals row with color-coded balances (red=unpaid, green=overpaid).
  - Export XLSX button (full report with header info + data table using xlsx library).
  - Export PDF button (via window.print() with print-friendly CSS).
  - New API endpoint /api/salary-report: Calculates paid amounts across all 10 deconsolidated tables including batch resolution, pension scheme adjustment, and cumulatives.
  - New BarChart3 (purple) icon in salary accruals row actions to open salary report in new tab. Actions column widened to 180px.
  - Page title registered for /salary-report route.
  - Bank XML import (deconsolidated): Added PGRST205 error handling â€” gracefully skips missing Supabase tables instead of failing.
  - DB cleanup: Deleted orphan bank account GE43BG0000000609494201 (no raw table, no parsing scheme).
  - DB fix: 20 nominal amount records fixed for counteragent áƒ¡áƒ˜áƒ©áƒ™áƒ”áƒœáƒ“áƒ”áƒ  (GELâ†’USD conversion using NBG rates).
- Commit: 3bdfe1d
- URL: https://ice-e5wxehilg-iceerp.vercel.app

## 2026-03-06 (1)
- Summary: Copy salary accrual to months feature; NBG rate missing warning; pendingâ†’completed multi-entry detection fix.
- Changes:
  - Salary accruals: New per-row "Copy to months" action (green Copy icon). Opens dialog showing source details and checkboxes for Â±36-month range. Existing months shown disabled/strikethrough. Records created on last day of selected month with new payment_id. deducted_insurance set to null on copy.
  - Bank import (deconsolidated): NBG exchange rate missing dates now tracked and reported in FINAL SUMMARY warning.
  - Bank import (deconsolidated): Pendingâ†’completed detection rewritten to handle multi-entry DocKeys (e.g. TRN+COM). Now stores all entries per DocKey and matches by date+amount per entry instead of keeping only max EntriesId.
  - Bank import (consolidated, bog-gel-processor): calculateNominalAmount updated with optional missingRateDates parameter for rate tracking.
  - Python import script: Added pendingâ†’completed detection and cleanup-pending-duplicates mode.
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
  - DB fix: Updated 2 payment records for counteragent áƒáƒ‘áƒ“áƒ£áƒš áƒ°áƒáƒ›áƒ”áƒ”áƒ“ áƒ¡áƒ˜áƒ©áƒ™áƒ”áƒœáƒ“áƒ”áƒ  from GEL to USD (payment IDs: 63810f_23_9be30c, 6f15fe_50_864951).
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
- Summary: Self.ge upload dialog enhancements: IBAN parsing, net=salaryÃ—80%, per-row add counteragent/salary buttons, comma-separated salary handling.
- Changes:
  - upload-self-ge API: Parse IBAN from `áƒáƒœáƒ’áƒáƒ áƒ˜áƒ¨áƒ˜áƒ¡ áƒœáƒáƒ›áƒ”áƒ áƒ˜` column; net sum calculated as `áƒ®áƒ”áƒšáƒ¤áƒáƒ¡áƒ˜ Ã— 0.8`; comma-separated salary values (e.g. "2000,5000") use rightmost number; IBAN included in all comparison result categories.
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
  - Counteragent statement: `date` â†’ `'date'`, `incomeTax`/`confirmed` â†’ `'boolean'`, `accrual`/`order`/`payment`/`ppc` â†’ `'currency'`, `comment` â†’ `'text'`; pass `columnFormat={col.format}` to `ColumnFilterPopover`.
  - Payment statement: `date`/`createdAt` â†’ `'date'`, `confirmed` â†’ `'boolean'`, `accrual`/`payment`/`order`/`ppc`/`due`/`balance` â†’ `'currency'`, `paidPercent` â†’ `'percent'`, `comment` â†’ `'text'`; pass `columnFormat={column.format}` to `ColumnFilterPopover`.
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
  - New: `components/figma/shared/table-filters.ts` â€” shared filter engine with `FilterState` type, `matchesFilter()`, and predicates for facet/numeric/text/date modes.
  - Updated: `components/figma/shared/column-filter-popover.tsx` â€” added tabbed UI (Values + Condition) with numeric operators (>, <, between, =, â‰ , blank, not blank), text operators (contains, starts with, ends with, equals, blank), and date operators (=, >, <, between, blank).
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
  - UI (salary-accruals-table): Conditional row colors: confirmed + month_balance < 0 â†’ slight red (#ffebee), > 0 â†’ slight green (#e8f5e9), = 0 â†’ slight gray (#f3f4f6). Bold red counteragent name when cumulative_balance < 0.
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
  - API (8 routes): fix `COALESCE(nominal_amount, partition_amount)` â†’ `COALESCE(NULLIF(nominal_amount, 0), partition_amount)` so zero nominal_amount falls through to partition_amount in salary balance calculations.
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
  - API: add `/api/bank-transactions/bulk-bind` PATCH endpoint that groups synthetic IDs by source table, batch-fetches rows and NBG rates, and executes single `UPDATEâ€¦FROM(VALUES)` per table.
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

## 2026-02-16
- Summary: Bulk payment ID assignment with row checkboxes on bank-transactions-test page.
- Changes:
  - bank-transactions-table.tsx: Added selectionEnabled, selectedIds, onSelectionChange props; checkbox column in header (select-all for current page) and rows; selected rows highlighted blue.
  - BankTransactionsTestTableFigma.tsx: Bulk assign toolbar shown when rows are selected — payment ID input, Assign button PATCHes all selected transactions, local state updated, selection cleared on completion.
- Commit: 68eb305
- Production: https://ice-juw5dan8p-iceerp.vercel.app

## 2026-04-02
- Summary: Split payments report totals bar by income/expense per currency.
- Changes:
  - payments-report API: added fc.is_income to SQL query and financialCodeIsIncome to formatted response.
  - payments-report-table.tsx: totals bar boxes now show Income / Expense / Total columns side-by-side within each currency, using financial_codes.is_income to classify rows.
- Commit: 2997922
- Production: https://ice-oqp4ufudy-iceerp.vercel.app
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

## 2026-02-11
- Summary: Refactor jobs to use job_projects junction table for multi-project binding.
- Changes:
  - Jobs API: GET/POST/PUT/DELETE rewritten to use job_projects junction table instead of duplicate job rows.
  - Job-projects API: removed legacy jobs.project_uuid fallback.
  - Payments report API: jobs_per_project CTE now uses job_projects.
  - Jobs table UI: updated type, columns, edit dialog to support multiple project bindings via projectUuids array.
  - Prisma schema: project_uuid made optional on jobs model.
  - DB migration: job_projects backfilled from jobs.project_uuid, payment refs verified.
- Commit: 140c267
- Production: https://ice-cltbcyr0v-iceerp.vercel.app

## 2026-03-27
- Summary: Fix jobs page not showing project IDs due to stale cached column config.
- Changes:
  - Jobs table: bump column version from 3 to 4 to reset localStorage cached columns after junction table refactor.
- Commit: e6b146d
- Production: https://ice-mafp8ftgb-iceerp.vercel.app

## 2026-03-27
- Summary: Add bulk project binding with row checkboxes on jobs table.
- Changes:
  - Jobs table: added row checkboxes, select-all, and "Bind N to Projects" bulk action button with dialog.
  - Jobs API: added PATCH endpoint for bulk job-project binding via job_projects junction table.
- Commit: 44a5b02
- Production: https://ice-n1pfu02fz-iceerp.vercel.app

## 2026-03-27
- Summary: Show one row per job-project binding in jobs table instead of one row per job.
- Changes:
  - Jobs API: query JOINs job_projects to return per-binding rows with projectUuid, projectIndex, projectName.
  - Jobs table: updated type, columns, normalization, row keys, and edit dialog to support per-binding display.
  - Header shows "N bindings (M jobs)" count.
- Commit: ab1ad26
- Production: https://ice-nmkfjvmuq-iceerp.vercel.app

