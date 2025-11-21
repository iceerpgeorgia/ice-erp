-- Fix parent-child relationships based on code structure
-- This script infers parent relationships from hierarchical codes

-- Update parent_uuid based on code structure
-- For example: "1.2.3" should have parent "1.2", which should have parent "1"

UPDATE financial_codes child
SET parent_uuid = (
  SELECT parent.uuid
  FROM financial_codes parent
  WHERE parent.code = (
    -- Extract parent code by removing the last segment
    CASE 
      WHEN child.code LIKE '%.%.%' THEN 
        -- For codes like "1.2.3", parent is "1.2"
        regexp_replace(child.code, '\.[^.]+$', '')
      WHEN child.code LIKE '%.%' THEN
        -- For codes like "1.2", parent is "1"
        regexp_replace(child.code, '\.[^.]+$', '')
      ELSE
        -- Root level codes have no parent
        NULL
    END
  )
  LIMIT 1
)
WHERE child.code LIKE '%.%'; -- Only update non-root codes

-- Verify the results
SELECT 
  c.code,
  c.name,
  c.uuid,
  c.parent_uuid,
  p.code as parent_code,
  c.depth
FROM financial_codes c
LEFT JOIN financial_codes p ON c.parent_uuid = p.uuid
ORDER BY c.depth, c.sort_order, c.code;
