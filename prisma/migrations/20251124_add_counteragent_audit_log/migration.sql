-- CreateTable
CREATE TABLE "counteragent_audit_log" (
    "id" BIGSERIAL NOT NULL,
    "counteragent_id" BIGINT NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "operation" TEXT NOT NULL,

    CONSTRAINT "counteragent_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "counteragent_audit_log_counteragent_id_idx" ON "counteragent_audit_log"("counteragent_id");

-- CreateIndex
CREATE INDEX "counteragent_audit_log_changed_at_idx" ON "counteragent_audit_log"("changed_at");

-- AddForeignKey
ALTER TABLE "counteragent_audit_log" ADD CONSTRAINT "counteragent_audit_log_counteragent_id_fkey" FOREIGN KEY ("counteragent_id") REFERENCES "counteragents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
