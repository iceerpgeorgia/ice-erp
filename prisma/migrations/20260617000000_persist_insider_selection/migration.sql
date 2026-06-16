-- Persist selected insider UUIDs per user so selection survives cookie/domain resets.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS selected_insider_uuids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
