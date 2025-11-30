-- Step 1: Check how many counteragents have null country_uuid
SELECT 
  COUNT(*) as total_null_country_uuid,
  COUNT(DISTINCT country) as distinct_countries
FROM public.counteragents 
WHERE country_uuid IS NULL;

-- Step 2: See which countries are referenced but don't have UUIDs
SELECT 
  country, 
  COUNT(*) as count
FROM public.counteragents 
WHERE country_uuid IS NULL
GROUP BY country
ORDER BY count DESC;

-- Step 3: Backfill country_uuid based on country name
-- This updates counteragents by matching country name to countries.name_ka
UPDATE public.counteragents ca
SET country_uuid = c.country_uuid::text
FROM public.countries c
WHERE ca.country_uuid IS NULL 
  AND ca.country IS NOT NULL
  AND c.name_ka = ca.country;

-- Step 4: Verify the backfill worked
SELECT 
  COUNT(*) as remaining_null_country_uuid
FROM public.counteragents 
WHERE country_uuid IS NULL;

-- Step 5: Fire the trigger to repopulate country field with correct name_ka
-- (In case the stored country name doesn't exactly match name_ka)
UPDATE public.counteragents
SET country_uuid = country_uuid
WHERE country_uuid IS NOT NULL;
