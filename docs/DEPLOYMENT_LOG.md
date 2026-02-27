# Deployment Log

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
