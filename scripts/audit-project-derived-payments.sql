-- Audit: Which projects already have a matching project-derived payment,
-- and which ones are missing one?
--
-- Run this AFTER:
--  1. The 20260326140000 migration adds automated_payment_id column
--  2. You've set automated_payment_id=true on the relevant financial codes
--
-- The query shows every project whose financial code has automated_payment_id=true,
-- whether a project-derived payment already exists, and the payment_id if any.

SELECT
  p.project_uuid,
  p.project_name,
  fc.code   AS financial_code,
  fc.name   AS financial_code_name,
  fc.automated_payment_id,
  pay.id    AS derived_payment_id,
  pay.payment_id,
  pay.is_active AS payment_is_active,
  CASE
    WHEN pay.id IS NOT NULL AND pay.is_active = true THEN 'OK - has active derived payment'
    WHEN pay.id IS NOT NULL AND pay.is_active = false THEN 'WARNING - derived payment inactive'
    WHEN pay.id IS NULL AND fc.automated_payment_id = true THEN 'MISSING - should have derived payment'
    ELSE 'N/A - financial code does not require auto-payment'
  END AS status
FROM projects p
JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
LEFT JOIN payments pay
  ON pay.project_uuid = p.project_uuid
  AND pay.is_project_derived = true
WHERE fc.automated_payment_id = true
ORDER BY status, p.project_name;
