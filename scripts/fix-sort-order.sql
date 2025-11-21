-- Fix sortOrder for existing financial codes
-- This assigns sortOrder based on the code value for existing records

-- Update root level codes (no parent)
WITH ranked_roots AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY code) as rn
  FROM financial_codes
  WHERE parent_uuid IS NULL
)
UPDATE financial_codes fc
SET sort_order = rr.rn
FROM ranked_roots rr
WHERE fc.id = rr.id;

-- Update child codes (group by parent and order by code)
WITH ranked_children AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_uuid ORDER BY code) as rn
  FROM financial_codes
  WHERE parent_uuid IS NOT NULL
)
UPDATE financial_codes fc
SET sort_order = rc.rn
FROM ranked_children rc
WHERE fc.id = rc.id;

-- Verify results
SELECT code, name, parent_uuid, sort_order, depth
FROM financial_codes
ORDER BY depth, sort_order, code;
