-- Reset all employee flags to false in Supabase
-- Run this in Supabase SQL Editor

UPDATE counteragents 
SET is_emploee = false, was_emploee = false;

-- Verify the update
SELECT COUNT(*) as total_counteragents,
       SUM(CASE WHEN is_emploee = true THEN 1 ELSE 0 END) as employees_count,
       SUM(CASE WHEN was_emploee = true THEN 1 ELSE 0 END) as was_employees_count
FROM counteragents;
