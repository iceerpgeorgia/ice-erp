-- countries_migration_triggers.sql
-- Use this instead of a DEFAULT expression referencing other columns.
-- It creates the table (if missing), regex constraints, and triggers
-- to auto-maintain `country` and `updated_at`.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Table
CREATE TABLE IF NOT EXISTS public.countries (
  id           bigserial PRIMARY KEY,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  ts           timestamptz NOT NULL DEFAULT now(),
  country_uuid uuid        NOT NULL DEFAULT gen_random_uuid(),
  name_en      text        NOT NULL,
  name_ka      text        NOT NULL,
  iso2         char(2)     NOT NULL,
  iso3         char(3)     NOT NULL,
  un_code      integer,
  country      text        NULL
);

-- 2) Unique indices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_countries_iso2') THEN
    CREATE UNIQUE INDEX uq_countries_iso2 ON public.countries(iso2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_countries_iso3') THEN
    CREATE UNIQUE INDEX uq_countries_iso3 ON public.countries(iso3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_countries_country_uuid') THEN
    CREATE UNIQUE INDEX uq_countries_country_uuid ON public.countries(country_uuid);
  END IF;
END $$;

-- 3) Regex checks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_countries_name_en_regex') THEN
    ALTER TABLE public.countries DROP CONSTRAINT chk_countries_name_en_regex;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_countries_name_ka_regex') THEN
    ALTER TABLE public.countries DROP CONSTRAINT chk_countries_name_ka_regex;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_countries_iso2_regex') THEN
    ALTER TABLE public.countries DROP CONSTRAINT chk_countries_iso2_regex;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_countries_iso3_regex') THEN
    ALTER TABLE public.countries DROP CONSTRAINT chk_countries_iso3_regex;
  END IF;
END $$;

ALTER TABLE public.countries
  ADD CONSTRAINT chk_countries_name_en_regex CHECK (name_en ~ '^[A-Za-z]+(?:[ -][A-Za-z]+)*$');

ALTER TABLE public.countries
  ADD CONSTRAINT chk_countries_name_ka_regex CHECK (name_ka ~ '^[ა-ჰ]+(?:[ -][ა-ჰ]+)*$');

ALTER TABLE public.countries
  ADD CONSTRAINT chk_countries_iso2_regex CHECK (iso2 ~ '^[A-Z]{2}$');

ALTER TABLE public.countries
  ADD CONSTRAINT chk_countries_iso3_regex CHECK (iso3 ~ '^[A-Z]{3}$');

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_countries_updated_at ON public.countries;
CREATE TRIGGER trg_countries_updated_at
BEFORE UPDATE ON public.countries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 5) country label trigger (compute from name_ka + iso3)
CREATE OR REPLACE FUNCTION public.set_countries_country() RETURNS trigger AS $$
BEGIN
  NEW.country := COALESCE(NEW.name_ka, '') || ' - ' || COALESCE(NEW.iso3, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_countries_country_bi ON public.countries;
CREATE TRIGGER trg_countries_country_bi
BEFORE INSERT ON public.countries
FOR EACH ROW
EXECUTE FUNCTION public.set_countries_country();

DROP TRIGGER IF EXISTS trg_countries_country_bu ON public.countries;
CREATE TRIGGER trg_countries_country_bu
BEFORE UPDATE OF name_ka, iso3 ON public.countries
FOR EACH ROW
EXECUTE FUNCTION public.set_countries_country();
