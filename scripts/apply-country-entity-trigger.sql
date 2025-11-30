-- Step 1: Create the function
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
