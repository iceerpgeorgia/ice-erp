# scripts/apply-counteragents-rules.ps1
$ErrorActionPreference = 'Stop'

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $dir = Split-Path $Path; if ($dir) { New-Item -ItemType Directory -Force $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

# 0) Remove any failing "counteragents_rules" migrations (shadow DB won’t need them)
Get-ChildItem -Path "prisma\migrations" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'counteragents_rules' } |
  ForEach-Object { Write-Host "Removing $($_.Name)"; Remove-Item -Recurse -Force $_.FullName }

# 1) Write the rules SQL (idempotent)
$rules = @'
-- prisma/counteragents_rules.sql

-- 1) Partial unique index on identification_number
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

-- 2) Sex must be 'Male'/'Female' or NULL
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

-- 3) Maintain derived "counteragent" label on insert/update
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
'@
Write-Utf8NoBom "prisma\counteragents_rules.sql" $rules

# 2) Ensure DB schema matches prisma/schema.prisma (creates columns/tables)
.\node_modules\.bin\prisma.cmd db push

# 3) Apply rules directly (no shadow DB involved)
.\node_modules\.bin\prisma.cmd db execute --file "prisma\counteragents_rules.sql" --schema "prisma\schema.prisma"

# 4) Regenerate client
.\node_modules\.bin\prisma.cmd generate

Write-Host "`n✅ Rules applied with 'prisma db execute'. Start the dev server: npm run dev"
