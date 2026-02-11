-- Backfill batch partition fields from payments
-- 1) Use payment_uuid (payments.record_uuid)
UPDATE bank_transaction_batches btb
SET
  payment_id = COALESCE(btb.payment_id, p.payment_id),
  counteragent_uuid = COALESCE(btb.counteragent_uuid, p.counteragent_uuid),
  project_uuid = COALESCE(btb.project_uuid, p.project_uuid),
  financial_code_uuid = COALESCE(btb.financial_code_uuid, p.financial_code_uuid),
  nominal_currency_uuid = COALESCE(btb.nominal_currency_uuid, p.currency_uuid)
FROM payments p
WHERE btb.payment_uuid IS NOT NULL
  AND p.record_uuid = btb.payment_uuid
  AND (
    btb.payment_id IS NULL
    OR btb.counteragent_uuid IS NULL
    OR btb.project_uuid IS NULL
    OR btb.financial_code_uuid IS NULL
    OR btb.nominal_currency_uuid IS NULL
  );

-- 2) Fallback by payment_id when payment_uuid is missing
UPDATE bank_transaction_batches btb
SET
  payment_uuid = COALESCE(btb.payment_uuid, p.record_uuid),
  counteragent_uuid = COALESCE(btb.counteragent_uuid, p.counteragent_uuid),
  project_uuid = COALESCE(btb.project_uuid, p.project_uuid),
  financial_code_uuid = COALESCE(btb.financial_code_uuid, p.financial_code_uuid),
  nominal_currency_uuid = COALESCE(btb.nominal_currency_uuid, p.currency_uuid)
FROM payments p
WHERE btb.payment_uuid IS NULL
  AND btb.payment_id IS NOT NULL
  AND p.payment_id = btb.payment_id
  AND (
    btb.payment_uuid IS NULL
    OR btb.counteragent_uuid IS NULL
    OR btb.project_uuid IS NULL
    OR btb.financial_code_uuid IS NULL
    OR btb.nominal_currency_uuid IS NULL
  );
