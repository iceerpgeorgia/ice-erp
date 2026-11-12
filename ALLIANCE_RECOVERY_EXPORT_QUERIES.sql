-- ============================================================================
-- ALLIANCE HIGHLINE COST PAYMENT RECOVERY - SQL EXPORT QUERIES
-- ============================================================================
-- 
-- These queries export the cost payment data from production Supabase.
-- Since CSV export has a 100-row limit, queries are split into batches.
--
-- Project UUID: dc975886-9bf9-42c8-afbe-87695aa01262
-- Expected: 20 cost payment records (waybill_derived = TRUE)
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Copy each query below
-- 3. Run the query
-- 4. Download CSV (click download button in results)
-- 5. Save CSV files locally
--
-- ============================================================================

-- ============================================================================
-- QUERY 1: Export ORPHANED COST PAYMENTS (payment_id = NULL) from PRODUCTION
-- ============================================================================
-- These are the records that need recovery
-- Expected: 20 rows

SELECT 
    p.id,
    p.uuid,
    p.payment_id,
    p.project_uuid,
    p.counteragent_uuid,
    p.financial_code_uuid,
    p.currency_uuid,
    p.amount,
    p.waybill_derived,
    p.is_project_derived,
    p.is_bundle_payment,
    p.job_uuid,
    p.created_at,
    p.updated_at,
    p.accrual_source,
    p.income_tax,
    p.waybill_no,
    p.waybill_id,
    p.waybill_derived_sum,
    fc.code as financial_code,
    ca.name as counteragent_name
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = TRUE
    AND p.payment_id IS NULL
ORDER BY 
    p.financial_code_uuid,
    p.counteragent_uuid,
    p.created_at;

-- ============================================================================
-- QUERY 2: Export ALL COST PAYMENTS (including those with payment_id) 
-- from PRODUCTION - for reference
-- ============================================================================
-- This shows all cost payments, including any that still have payment_id
-- Expected: 20 rows (assuming all are orphaned)

SELECT 
    p.id,
    p.uuid,
    p.payment_id,
    p.project_uuid,
    p.counteragent_uuid,
    p.financial_code_uuid,
    p.currency_uuid,
    p.amount,
    p.waybill_derived,
    p.is_project_derived,
    p.is_bundle_payment,
    p.job_uuid,
    p.created_at,
    p.updated_at,
    p.accrual_source,
    p.income_tax,
    p.waybill_no,
    p.waybill_id,
    p.waybill_derived_sum,
    fc.code as financial_code,
    ca.name as counteragent_name
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = TRUE
ORDER BY 
    p.financial_code_uuid,
    p.counteragent_uuid,
    p.created_at;

-- ============================================================================
-- QUERY 3: Export INCOME PAYMENTS (payment_id should be NULL - as intended)
-- from PRODUCTION - for verification
-- ============================================================================
-- These should have payment_id = NULL (as intended by the operation)
-- Expected: 71 rows

SELECT 
    p.id,
    p.uuid,
    p.payment_id,
    p.project_uuid,
    p.counteragent_uuid,
    p.financial_code_uuid,
    p.currency_uuid,
    p.amount,
    p.waybill_derived,
    p.is_project_derived,
    p.is_bundle_payment,
    p.job_uuid,
    p.created_at,
    p.accrual_source,
    fc.code as financial_code,
    ca.name as counteragent_name
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = FALSE
ORDER BY 
    p.counteragent_uuid,
    p.created_at;

-- ============================================================================
-- QUERY 4: Export WAYBILLS for Alliance Highline (recovery source data)
-- ============================================================================
-- These are the source records for cost payments
-- Each waybill should correspond to a waybill-derived payment
-- Expected: ~20-40 rows

SELECT 
    w.id,
    w.uuid,
    w.rs_id,
    w.waybill_no,
    w.project_uuid,
    w.counteragent_uuid,
    w.financial_code_uuid,
    w.sum,
    w.unit_id,
    w.unit,
    w.type,
    w.begin_date,
    w.create_date,
    w.confirm_date,
    w.vat,
    w.created_at,
    w.updated_at,
    fc.code as financial_code,
    ca.name as counteragent_name,
    pr.name as project_name
FROM rs_waybills_in_api w
LEFT JOIN financial_codes fc ON w.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON w.counteragent_uuid = ca.uuid
LEFT JOIN projects pr ON w.project_uuid = pr.uuid
WHERE 
    w.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
ORDER BY 
    w.created_at DESC;

-- ============================================================================
-- QUERY 5: Export PAYMENT LEDGER entries for cost payments
-- ============================================================================
-- Shows which ledger entries are associated with cost payments
-- Expected: 20+ rows

SELECT 
    pl.id,
    pl.uuid,
    pl.payment_uuid,
    pl.comment,
    pl.accrual,
    pl.order_amount,
    pl.is_confirmed,
    pl.created_at,
    pl.updated_at,
    p.payment_id,
    p.counteragent_uuid,
    p.financial_code_uuid,
    fc.code as financial_code,
    ca.name as counteragent_name
FROM payments_ledger pl
JOIN payments p ON pl.payment_uuid = p.uuid
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = TRUE
ORDER BY 
    p.financial_code_uuid,
    p.counteragent_uuid,
    pl.created_at;

-- ============================================================================
-- INSTRUCTIONS FOR EXPORT
-- ============================================================================
--
-- HOW TO EXECUTE:
--
-- 1. Go to Supabase Dashboard: https://app.supabase.com/
-- 2. Select your project: "ice-erp" (fojbzghphznbslqwurrm)
-- 3. Go to: SQL Editor
-- 4. Create new query
-- 5. Copy QUERY 1 (above) into the editor
-- 6. Click "RUN" button
-- 7. Wait for results (should show 20 rows)
-- 8. Click "Download CSV" button (bottom right of results)
-- 9. Save as: alliance_orphaned_payments.csv
--
-- Repeat for QUERY 2, QUERY 4, QUERY 5 if needed for verification.
--
-- ============================================================================
-- NOTES:
-- ============================================================================
--
-- - Each CSV export is limited to 100 rows by Supabase
-- - Query 1 should return exactly 20 rows (the orphaned cost payments)
-- - Query 3 should return 71 rows (income payments - export in batches if needed)
-- - Query 4 returns waybill source data for reference
-- - Query 5 shows the ledger entries (related to cost payments)
--
-- After exporting CSVs, you'll use them with the matching script:
--   scripts/alliance-recovery-backup-match.ts
--
-- The script will:
-- 1. Load the CSVs
-- 2. Group by (financial_code_uuid, counteragent_uuid)
-- 3. Match by ordinal position within each group
-- 4. Generate recovery SQL to restore payment_ids
--
-- ============================================================================
