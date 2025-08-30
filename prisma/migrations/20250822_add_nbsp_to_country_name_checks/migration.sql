-- prisma/migrations/20250822_add_nbsp_to_country_name_checks/migration.sql
-- Normalize any existing NBSP (U+00A0) in names to a regular space and
-- replace the fragile regex constraints with safe ones that accept ASCII spaces.

BEGIN;

-- 1) Clean stray NBSPs → regular spaces (uses Postgres Unicode string literal)
UPDATE "countries"
SET
  name_en = regexp_replace(name_en, U&'!00A0' UESCAPE '!', ' ', 'g'),
  name_ka = regexp_replace(name_ka, U&'!00A0' UESCAPE '!', ' ', 'g')
WHERE name_en LIKE U&'%!00A0%' UESCAPE '!'
   OR name_ka LIKE U&'%!00A0%' UESCAPE '!';

-- 2) Drop previous fragile constraints if present
ALTER TABLE "countries" DROP CONSTRAINT IF EXISTS "chk_countries_name_en_regex";
ALTER TABLE "countries" DROP CONSTRAINT IF EXISTS "chk_countries_name_ka_regex";

-- 3) Recreate constraints

-- EN: letters + common punctuation + normal spaces only
--    (we moved hyphen to the end of the class to avoid range semantics)
ALTER TABLE "countries"
  ADD CONSTRAINT "chk_countries_name_en_regex"
  CHECK (name_en ~ $$^[A-Za-z&().,/' -]+$$);

-- KA: keep it simple and robust — just require non-empty after trim
ALTER TABLE "countries"
  ADD CONSTRAINT "chk_countries_name_ka_nonempty"
  CHECK (btrim(name_ka) <> '');

COMMIT;
