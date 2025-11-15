-- prisma/counteragents_rules.sql

-- Unique (partial) index: identification_number unique except for 2 entity types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ux_counteragents_identification_number_partial'
  ) THEN
    EXECUTE $I$
      CREATE UNIQUE INDEX ux_counteragents_identification_number_partial
      ON public.counteragents(identification_number)
      WHERE identification_number IS NOT NULL
        AND entity_type_uuid NOT IN
          ('f5c3c745-eaa4-4e27-a73b-badc9ebb49c0', '7766e9c2-0094-4090-adf4-ef017062457f');
    $I$;
  END IF;
END$$;

-- Sex must be Male/Female (or NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='counteragents' AND constraint_name='ck_counteragents_sex'
  ) THEN
    ALTER TABLE public.counteragents
      ADD CONSTRAINT ck_counteragents_sex
      CHECK (sex IN ('Male','Female') OR sex IS NULL);
  END IF;
END$$;

-- Populate country and entity_type from UUIDs
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_counteragents_populate_names') THEN
    DROP TRIGGER trg_counteragents_populate_names ON public.counteragents;
  END IF;

  CREATE TRIGGER trg_counteragents_populate_names
  BEFORE INSERT OR UPDATE OF country_uuid, entity_type_uuid
  ON public.counteragents
  FOR EACH ROW
  EXECUTE FUNCTION public.counteragents_populate_names();
END$$;

-- Derived label "counteragent" = name + (ს.კ. id_or_internal - entity_type.name_ka)
CREATE OR REPLACE FUNCTION public.counteragents_set_label()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  et_name_ka text;
  id_or_internal text;
BEGIN
  SELECT et.name_ka INTO et_name_ka
  FROM public.entity_types et
  WHERE et.entity_type_uuid = NEW.entity_type_uuid;

  id_or_internal := COALESCE(NULLIF(NEW.identification_number,''), NEW.internal_number);

  NEW.counteragent :=
      COALESCE(NEW.name,'')
      || ' (ს.კ. '
      || COALESCE(id_or_internal,'')
      || ' - '
      || COALESCE(et_name_ka,'')
      || ')';

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_counteragents_set_label') THEN
    DROP TRIGGER trg_counteragents_set_label ON public.counteragents;
  END IF;

  CREATE TRIGGER trg_counteragents_set_label
  BEFORE INSERT OR UPDATE OF name, identification_number, internal_number, entity_type_uuid
  ON public.counteragents
  FOR EACH ROW
  EXECUTE FUNCTION public.counteragents_set_label();
END$$;
