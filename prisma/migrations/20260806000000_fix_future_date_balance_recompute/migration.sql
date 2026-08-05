-- Fix "Invalid range" error when importing transactions with future dates
-- When a transaction is dated in the future (e.g., 2026-08-06 when today is 2026-08-05),
-- the balance recompute trigger should skip processing since we can't calculate balances
-- for dates that haven't occurred yet.

CREATE OR REPLACE FUNCTION trg_recompute_bank_account_balance_periods_from_raw()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_uuid uuid;
  v_from_date date;
BEGIN
  v_account_uuid := get_bank_account_uuid_for_raw_table(TG_TABLE_NAME);
  IF v_account_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_from_date := NEW.transaction_date::date;
  ELSIF TG_OP = 'DELETE' THEN
    v_from_date := OLD.transaction_date::date;
  ELSE
    v_from_date := LEAST(COALESCE(NEW.transaction_date::date, CURRENT_DATE), COALESCE(OLD.transaction_date::date, CURRENT_DATE));
  END IF;

  -- Skip balance recomputation if transaction date is in the future
  -- (we can only recompute balances for dates up to today)
  IF v_from_date > CURRENT_DATE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM recompute_bank_account_balance_periods(v_account_uuid, v_from_date, CURRENT_DATE);
  RETURN COALESCE(NEW, OLD);
END;
$$;
