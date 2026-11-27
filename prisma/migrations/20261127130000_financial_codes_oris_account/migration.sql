-- ORIS account per financial code (added 2026-11-27): the corresponding account used to convert
-- waybill items to ORIS accounting entries. Free text, entered on the Financial Codes page.
ALTER TABLE financial_codes ADD COLUMN IF NOT EXISTS oris_account text;
