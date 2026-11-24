-- New RS unit texts without a dimension are classified by Claude in the :30 cron
-- (lib/waybills/llm-unit-mapping.ts). Confident answers (>= 0.85) set dimension_uuid, which moves the
-- items through trg_rs_unit_dimension_map_sync_items; the rest stay unmapped. Admins are emailed once
-- per unit text (admin_notified_at) about both outcomes.
ALTER TABLE rs_unit_dimension_map
  ADD COLUMN IF NOT EXISTS ai_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_dimension_uuid uuid REFERENCES dimensions(uuid) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_mapped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_notified_at timestamptz;
