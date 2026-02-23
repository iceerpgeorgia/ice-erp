-- Allow deconfirm updates to confirmed payments_ledger rows when a session flag is set.
-- Run this in Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.prevent_confirmed_payments_ledger_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.confirmed = true THEN
    IF current_setting('app.allow_deconfirm', true) = 'true' AND NEW.confirmed = false THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Confirmed entry can not be modified (id=%)', OLD.id
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' AND OLD.confirmed = true THEN
    RAISE EXCEPTION 'Confirmed entry can not be deleted (id=%)', OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;
