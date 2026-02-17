# Deployment Log

## 2026-02-17
- Summary: Enable BOG USD deconsolidated uploads.
- Changes:
  - Bank transactions upload: route BOG XML to deconsolidated processing and resolve BOG_USD tables.
  - Deconsolidated importer: force BOG_USD scheme for USD accounts.
  - Import script: support BOG_USD table name derivation when missing.
- Commit: a02f46b
- Production: https://ice-oq9ojyouw-iceerp.vercel.app

## 2026-02-18
- Summary: Switch bank XML uploads to Supabase Storage.
- Changes:
  - Bank transactions: upload XML files to Supabase Storage and pass public URLs to the import API.
  - Blob upload route: disable legacy Vercel Blob handler.
- Commit: 54e47dd
- Production: https://ice-ko1t28e0u-iceerp.vercel.app

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
