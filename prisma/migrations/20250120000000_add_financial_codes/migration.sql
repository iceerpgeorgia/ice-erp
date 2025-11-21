-- CreateTable
CREATE TABLE "financial_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "sign" CHAR(1) NOT NULL,
    "node_type" TEXT NOT NULL,
    "level_1" INTEGER NOT NULL,
    "level_2" INTEGER NOT NULL DEFAULT 0,
    "level_3" INTEGER NOT NULL DEFAULT 0,
    "level_4" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL,
    "applies_to_pl" BOOLEAN NOT NULL DEFAULT false,
    "applies_to_cf" BOOLEAN NOT NULL DEFAULT false,
    "is_formula" BOOLEAN NOT NULL DEFAULT false,
    "formula_expression" TEXT,
    "category" TEXT,
    "customs_category" TEXT,
    "oris_account" TEXT,
    "validation" TEXT,
    "order_description" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_code_paths" (
    "id" UUID NOT NULL,
    "ancestor_id" UUID NOT NULL,
    "descendant_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "financial_code_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT NOT NULL,
    "financial_code_id" UUID NOT NULL,
    "counteragent_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_codes_code_key" ON "financial_codes"("code");

-- CreateIndex
CREATE INDEX "financial_codes_code_idx" ON "financial_codes"("code");

-- CreateIndex
CREATE INDEX "financial_codes_level_1_level_2_level_3_level_4_idx" ON "financial_codes"("level_1", "level_2", "level_3", "level_4");

-- CreateIndex
CREATE INDEX "financial_codes_node_type_idx" ON "financial_codes"("node_type");

-- CreateIndex
CREATE INDEX "financial_codes_is_formula_idx" ON "financial_codes"("is_formula");

-- CreateIndex
CREATE INDEX "financial_codes_applies_to_pl_idx" ON "financial_codes"("applies_to_pl");

-- CreateIndex
CREATE INDEX "financial_codes_applies_to_cf_idx" ON "financial_codes"("applies_to_cf");

-- CreateIndex
CREATE UNIQUE INDEX "financial_code_paths_ancestor_id_descendant_id_key" ON "financial_code_paths"("ancestor_id", "descendant_id");

-- CreateIndex
CREATE INDEX "financial_code_paths_ancestor_id_depth_idx" ON "financial_code_paths"("ancestor_id", "depth");

-- CreateIndex
CREATE INDEX "financial_code_paths_descendant_id_idx" ON "financial_code_paths"("descendant_id");

-- CreateIndex
CREATE INDEX "transactions_financial_code_id_date_idx" ON "transactions"("financial_code_id", "date");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_counteragent_id_idx" ON "transactions"("counteragent_id");

-- AddForeignKey
ALTER TABLE "financial_code_paths" ADD CONSTRAINT "financial_code_paths_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "financial_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_code_paths" ADD CONSTRAINT "financial_code_paths_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "financial_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financial_code_id_fkey" FOREIGN KEY ("financial_code_id") REFERENCES "financial_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counteragent_id_fkey" FOREIGN KEY ("counteragent_id") REFERENCES "counteragents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
