-- Add unique constraint on identification_number (excluding NULLs)
-- This prevents duplicate ID numbers while allowing multiple NULL values
-- for exempt entity types (Municipal Service, Government Service)

-- Step 1: Check for existing duplicates (excluding NULLs)
SELECT 
  identification_number, 
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as duplicate_ids
FROM public.counteragents
WHERE identification_number IS NOT NULL
GROUP BY identification_number
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 2: Create partial unique index (only indexes non-NULL values)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_counteragents_identification_number_unique
ON public.counteragents (identification_number)
WHERE identification_number IS NOT NULL;

-- Step 3: Verify the index was created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'counteragents' 
  AND indexname = 'idx_counteragents_identification_number_unique';

-- Note: If Step 1 shows duplicates, you need to decide how to handle them:
-- Option A: Keep the newest record and delete older ones
-- Option B: Manually review and merge the records
-- Option C: Update one of the duplicate IDs to make them unique

-- Example cleanup query (DO NOT RUN without reviewing duplicates first):
-- DELETE FROM public.counteragents
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, identification_number,
--            ROW_NUMBER() OVER (PARTITION BY identification_number ORDER BY created_at DESC) as rn
--     FROM public.counteragents
--     WHERE identification_number IS NOT NULL
--   ) t
--   WHERE rn > 1
-- );
