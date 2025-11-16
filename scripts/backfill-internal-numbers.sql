-- Backfill internal_number for records that are missing it
-- Format: ICE + zero-padded 4-digit ID (ICE0001, ICE0123, ICE3282, etc.)

UPDATE public.counteragents
SET internal_number = 'ICE' || LPAD(id::text, 4, '0')
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
