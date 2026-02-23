-- Swap surplus_insurance and deducted_insurance for the specified counteragent
-- Excludes Jan 2026 (2026-01-01 to 2026-01-31)

UPDATE salary_accruals sa
SET
  surplus_insurance = sa.deducted_insurance,
  deducted_insurance = sa.surplus_insurance,
  updated_at = NOW()
WHERE sa.counteragent_uuid IN (
  SELECT c.counteragent_uuid
  FROM counteragents c
  WHERE c.identification_number = '01008045332'
)
AND NOT (sa.salary_month >= DATE '2026-01-01' AND sa.salary_month < DATE '2026-02-01');
