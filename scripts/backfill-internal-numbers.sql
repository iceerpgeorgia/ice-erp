-- Backfill internal_number for records that are missing it
-- Format: ICE + zero-padded 6-digit ID (ICE000001, ICE000123, ICE003282, etc.)

UPDATE public.counteragents
SET internal_number = 'ICE' || LPAD(id::text, 6, '0')
WHERE internal_number IS NULL;

-- Verify the update
SELECT id, name, internal_number
FROM public.counteragents
WHERE id IN (3282, 3283)
ORDER BY id DESC;

-- Optional: Show all records to confirm format
SELECT id, name, internal_number
FROM public.counteragents
ORDER BY id DESC
LIMIT 20;
