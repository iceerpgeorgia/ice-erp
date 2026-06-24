-- CreateTable templates
CREATE TABLE "templates" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operation_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'supabase',
    "storage_bucket" TEXT,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT,
    "file_hash_sha256" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "templates_uuid_key" ON "templates"("uuid");

-- CreateIndex
CREATE INDEX "idx_templates_operation_type" ON "templates"("operation_type");

-- CreateIndex
CREATE INDEX "idx_templates_is_active" ON "templates"("is_active");

-- CreateIndex
CREATE INDEX "idx_templates_created_at" ON "templates"("created_at");

-- CreateIndex for operation_type + is_active lookup
CREATE INDEX "idx_templates_operation_active" ON "templates"("operation_type", "is_active");

-- Create trigger to enforce only one active template per operation_type
CREATE OR REPLACE FUNCTION enforce_one_active_template_per_operation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE "templates"
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE operation_type = NEW.operation_type
      AND is_active = true
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_one_active_template_per_operation
BEFORE INSERT OR UPDATE ON "templates"
FOR EACH ROW
EXECUTE FUNCTION enforce_one_active_template_per_operation();

