-- Drop old regex checks if they exist
ALTER TABLE public.countries
  DROP CONSTRAINT IF EXISTS chk_countries_name_en_regex,
  DROP CONSTRAINT IF EXISTS chk_countries_name_ka_regex;

-- Allow letters (incl. accents), spaces, comma, dot, apostrophe, parentheses, hyphen
ALTER TABLE public.countries
  ADD CONSTRAINT chk_countries_name_en_regex
  CHECK (name_en ~ '^[[:alpha:] ,().''-]+$');

-- Allow Georgian letters, spaces, comma, dot, apostrophe, parentheses, hyphen
ALTER TABLE public.countries
  ADD CONSTRAINT chk_countries_name_ka_regex
  CHECK (name_ka ~ '^[ა-ჰ ,().''-]+$');
