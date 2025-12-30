-- CreateTable: Raw Bank Statements (Partitioned by bank_account_uuid)
CREATE TABLE "raw_bank_statements" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bank_account_uuid" UUID NOT NULL,
    "transaction_date" DATE NOT NULL,
    "value_date" DATE,
    "document_number" TEXT,
    "description" TEXT NOT NULL,
    "counterparty_name" TEXT,
    "counterparty_code" TEXT,
    "counterparty_account" TEXT,
    "debit" DECIMAL(18,2),
    "credit" DECIMAL(18,2),
    "balance" DECIMAL(18,2),
    "bank_format" TEXT NOT NULL,
    "import_batch_id" TEXT,
    "raw_data" JSONB,
    "is_parsed" BOOLEAN NOT NULL DEFAULT false,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_bank_statements_pkey" PRIMARY KEY ("id", "bank_account_uuid"),
    CONSTRAINT "raw_bank_statements_uuid_bank_account_key" UNIQUE ("uuid", "bank_account_uuid")
) PARTITION BY LIST (bank_account_uuid);

-- CreateTable: Standardized Transactions (Unified format)
CREATE TABLE "standardized_transactions" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bank_account_uuid" UUID NOT NULL,
    "raw_bank_statement_uuid" UUID,
    "transaction_date" DATE NOT NULL,
    "value_date" DATE,
    "document_number" TEXT,
    "description" TEXT NOT NULL,
    "counteragent_uuid" UUID,
    "project_uuid" UUID,
    "financial_code_uuid" UUID,
    "job_uuid" UUID,
    "debit" DECIMAL(18,2),
    "credit" DECIMAL(18,2),
    "balance" DECIMAL(18,2),
    "currency_uuid" UUID NOT NULL,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standardized_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_bank_statements_bank_account_uuid_idx" ON "raw_bank_statements"("bank_account_uuid");
CREATE INDEX "raw_bank_statements_transaction_date_idx" ON "raw_bank_statements"("transaction_date");
CREATE INDEX "raw_bank_statements_is_parsed_idx" ON "raw_bank_statements"("is_parsed");
CREATE INDEX "raw_bank_statements_is_reconciled_idx" ON "raw_bank_statements"("is_reconciled");
CREATE INDEX "raw_bank_statements_import_batch_id_idx" ON "raw_bank_statements"("import_batch_id");

CREATE UNIQUE INDEX "standardized_transactions_uuid_key" ON "standardized_transactions"("uuid");

CREATE INDEX "standardized_transactions_bank_account_uuid_idx" ON "standardized_transactions"("bank_account_uuid");
CREATE INDEX "standardized_transactions_transaction_date_idx" ON "standardized_transactions"("transaction_date");
CREATE INDEX "standardized_transactions_counteragent_uuid_idx" ON "standardized_transactions"("counteragent_uuid");
CREATE INDEX "standardized_transactions_project_uuid_idx" ON "standardized_transactions"("project_uuid");
CREATE INDEX "standardized_transactions_financial_code_uuid_idx" ON "standardized_transactions"("financial_code_uuid");
CREATE INDEX "standardized_transactions_is_reconciled_idx" ON "standardized_transactions"("is_reconciled");
CREATE INDEX "standardized_transactions_is_verified_idx" ON "standardized_transactions"("is_verified");

-- AddForeignKey
ALTER TABLE "raw_bank_statements" ADD CONSTRAINT "raw_bank_statements_bank_account_uuid_fkey" 
    FOREIGN KEY ("bank_account_uuid") REFERENCES "bank_accounts"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "standardized_transactions" ADD CONSTRAINT "standardized_transactions_bank_account_uuid_fkey" 
    FOREIGN KEY ("bank_account_uuid") REFERENCES "bank_accounts"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create function to automatically create partitions for new bank accounts
CREATE OR REPLACE FUNCTION create_raw_bank_statements_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_name TEXT;
BEGIN
    partition_name := 'raw_bank_statements_' || replace(NEW.uuid::text, '-', '_');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF raw_bank_statements FOR VALUES IN (%L)',
        partition_name,
        NEW.uuid
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create partition when bank account is created
CREATE TRIGGER trigger_create_raw_bank_statements_partition
    AFTER INSERT ON bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION create_raw_bank_statements_partition();

-- Create default partition for any unmatched records (safety net)
CREATE TABLE raw_bank_statements_default PARTITION OF raw_bank_statements DEFAULT;
