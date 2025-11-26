-- CreateTable
CREATE TABLE "project_states" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ts" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "counteragent_uuid" UUID NOT NULL,
    "project_name" TEXT NOT NULL,
    "financial_code_uuid" UUID NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "currency_uuid" UUID NOT NULL,
    "state_uuid" UUID NOT NULL,
    "oris_1630" TEXT,
    "contract_no" TEXT,
    "project_index" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_employees" (
    "id" BIGSERIAL NOT NULL,
    "project_uuid" UUID NOT NULL,
    "employee_uuid" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_employees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_states_uuid_key" ON "project_states"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "project_states_name_key" ON "project_states"("name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_uuid_key" ON "projects"("project_uuid");

-- CreateIndex
CREATE INDEX "projects_counteragent_uuid_idx" ON "projects"("counteragent_uuid");

-- CreateIndex
CREATE INDEX "projects_financial_code_uuid_idx" ON "projects"("financial_code_uuid");

-- CreateIndex
CREATE INDEX "projects_currency_uuid_idx" ON "projects"("currency_uuid");

-- CreateIndex
CREATE INDEX "projects_state_uuid_idx" ON "projects"("state_uuid");

-- CreateIndex
CREATE INDEX "projects_date_idx" ON "projects"("date");

-- CreateIndex
CREATE INDEX "project_employees_project_uuid_idx" ON "project_employees"("project_uuid");

-- CreateIndex
CREATE INDEX "project_employees_employee_uuid_idx" ON "project_employees"("employee_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "project_employees_project_uuid_employee_uuid_key" ON "project_employees"("project_uuid", "employee_uuid");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_state_uuid_fkey" FOREIGN KEY ("state_uuid") REFERENCES "project_states"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_employees" ADD CONSTRAINT "project_employees_project_uuid_fkey" FOREIGN KEY ("project_uuid") REFERENCES "projects"("project_uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert default project states
INSERT INTO "project_states" ("name", "is_active") VALUES
    ('Draft', true),
    ('Active', true),
    ('On Hold', true),
    ('Completed', true),
    ('Cancelled', true);
