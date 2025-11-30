-- Standardize ALL internal_numbers to 6-digit format: ICE000001, ICE000002, etc.
-- This updates both null values and existing 4-digit format

-- Step 1: Update ALL records to use 6-digit format (including existing ones)
UPDATE public.counteragents
SET internal_number = 'ICE' || LPAD(id::text, 6, '0');

-- Step 2: Verify the format
SELECT 
  id, 
  name, 
  internal_number,
  LENGTH(internal_number) as length,
  CASE 
    WHEN internal_number LIKE 'ICE______' THEN '✓ Correct (9 chars)'
    ELSE '✗ Wrong format'
  END as format_check
FROM public.counteragents
ORDER BY id DESC
LIMIT 20;

-- Step 3: Count records by format
SELECT 
  LENGTH(internal_number) as length,
  COUNT(*) as count,
  MIN(internal_number) as example
FROM public.counteragents
GROUP BY LENGTH(internal_number)
ORDER BY length;
