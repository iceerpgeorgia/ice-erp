-- Persist insider display text in DB.
ALTER TABLE IF EXISTS counteragents
  ADD COLUMN IF NOT EXISTS insider_name text;

-- Backfill insider_name from linked insider row when insider_uuid is set.
UPDATE counteragents c
SET insider_name = COALESCE(src.counteragent, src.name, c.insider_name)
FROM counteragents src
WHERE c.insider_uuid IS NOT NULL
  AND src.counteragent_uuid = c.insider_uuid
  AND (c.insider_name IS NULL OR btrim(c.insider_name) = '');

-- If row itself is marked as insider, default insider_name to its own label.
UPDATE counteragents c
SET insider_name = COALESCE(c.counteragent, c.name)
WHERE c.insider = true
  AND (c.insider_name IS NULL OR btrim(c.insider_name) = '');
