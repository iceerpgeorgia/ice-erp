-- Create trigger to populate country and entity_type from UUIDs

CREATE OR REPLACE FUNCTION public.counteragents_populate_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Populate country from country_uuid
  IF NEW.country_uuid IS NOT NULL THEN
    SELECT c.name_ka INTO NEW.country
    FROM public.countries c
    WHERE c.country_uuid::text = NEW.country_uuid;
  ELSE
    NEW.country := NULL;
  END IF;

  -- Populate entity_type from entity_type_uuid
  IF NEW.entity_type_uuid IS NOT NULL THEN
    SELECT et.name_ka INTO NEW.entity_type
    FROM public.entity_types et
    WHERE et.entity_type_uuid = NEW.entity_type_uuid;
  ELSE
    NEW.entity_type := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_counteragents_populate_names ON public.counteragents;

-- Create the trigger
CREATE TRIGGER trg_counteragents_populate_names
  BEFORE INSERT OR UPDATE OF country_uuid, entity_type_uuid
  ON public.counteragents
  FOR EACH ROW
  EXECUTE FUNCTION public.counteragents_populate_names();

-- Backfill existing records
UPDATE public.counteragents c
SET 
  country = (SELECT name_ka FROM public.countries WHERE country_uuid::text = c.country_uuid),
  entity_type = (SELECT name_ka FROM public.entity_types WHERE entity_type_uuid = c.entity_type_uuid)
WHERE c.country_uuid IS NOT NULL OR c.entity_type_uuid IS NOT NULL;
