-- Create audit_log table in Supabase
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fojbzghphznbslqwurrm/sql
-- IMPORTANT: Drop the old table first if it exists

DROP TABLE IF EXISTS "AuditLog" CASCADE;

CREATE TABLE "AuditLog" (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "table" TEXT NOT NULL,
    record_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    user_email TEXT,
    user_id TEXT,
    changes JSONB
);

-- Create indexes for better query performance
CREATE INDEX "AuditLog_table_record_id_idx" ON "AuditLog"("table", record_id);
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"(created_at DESC);
CREATE INDEX "AuditLog_user_email_idx" ON "AuditLog"(user_email);

-- Verify table was created
SELECT * FROM "AuditLog" LIMIT 1;
