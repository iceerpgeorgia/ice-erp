BEGIN;

ALTER TABLE counteragents ADD COLUMN IF NOT EXISTS insider boolean DEFAULT false;
ALTER TABLE counteragents ADD COLUMN IF NOT EXISTS insider_uuid uuid;

CREATE INDEX IF NOT EXISTS idx_counteragents_insider_uuid ON counteragents(insider_uuid);

COMMIT;
