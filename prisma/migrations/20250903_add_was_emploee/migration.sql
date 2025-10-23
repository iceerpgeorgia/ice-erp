-- Add historical employment flag to counteragents
ALTER TABLE "counteragents"
  ADD COLUMN IF NOT EXISTS "was_emploee" boolean NOT NULL DEFAULT false;

