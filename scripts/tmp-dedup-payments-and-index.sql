WITH ranked AS (
  SELECT
    p.*, 
    ROW_NUMBER() OVER (
      PARTITION BY project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    FIRST_VALUE(payment_id) OVER (
      PARTITION BY project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS master_payment_id
  FROM payments p
  WHERE is_active = true
),
 dups AS (
  SELECT * FROM ranked WHERE rn > 1
),
 ins AS (
  INSERT INTO payment_id_duplicates (
    master_payment_id,
    duplicate_payment_id,
    project_uuid,
    counteragent_uuid,
    financial_code_uuid,
    job_uuid,
    income_tax,
    currency_uuid,
    created_at
  )
  SELECT
    d.master_payment_id,
    d.payment_id,
    d.project_uuid,
    d.counteragent_uuid,
    d.financial_code_uuid,
    d.job_uuid,
    d.income_tax,
    d.currency_uuid,
    NOW()
  FROM dups d
  WHERE NOT EXISTS (
    SELECT 1
    FROM payment_id_duplicates pid
    WHERE pid.master_payment_id = d.master_payment_id
      AND pid.duplicate_payment_id = d.payment_id
  )
  RETURNING duplicate_payment_id
)
UPDATE payments p
SET is_active = false,
    updated_at = NOW()
FROM dups d
WHERE p.id = d.id
  AND p.is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS payments_unique_active_composite_idx
  ON payments (project_uuid, counteragent_uuid, financial_code_uuid, job_uuid, income_tax, currency_uuid)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS payments_payment_id_unique_idx
  ON payments (payment_id);
