-- CreateIndex
CREATE UNIQUE INDEX "salary_accruals_ca_fc_month_unique" ON "salary_accruals"("counteragent_uuid", "financial_code_uuid", "salary_month");
