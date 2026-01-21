-- Drop insurance_limit column from salary_accruals table
ALTER TABLE salary_accruals DROP COLUMN IF EXISTS insurance_limit;
