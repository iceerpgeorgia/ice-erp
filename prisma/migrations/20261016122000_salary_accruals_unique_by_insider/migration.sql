-- Replace salary accrual uniqueness to include insider scope.
DROP INDEX IF EXISTS "salary_accruals_ca_fc_month_unique";

CREATE UNIQUE INDEX "salary_accruals_ca_fc_month_insider_unique"
ON "salary_accruals"("counteragent_uuid", "financial_code_uuid", "salary_month", "insider_uuid");
