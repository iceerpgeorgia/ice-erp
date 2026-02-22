-- Prevent confirming ledger entries when due > balance.
-- Based on report formulas: due = total_order - abs(total_payment), balance = total_accrual - abs(total_payment).
-- This reduces to total_order > total_accrual, so bank payments do not affect the check.
-- Run this in Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.prevent_confirm_when_due_gt_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  total_accrual numeric;
  total_order numeric;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.confirmed = true
     AND COALESCE(OLD.confirmed, false) = false THEN
    SELECT
      COALESCE(SUM(accrual), 0),
      COALESCE(SUM("order"), 0)
    INTO total_accrual, total_order
    FROM payments_ledger
    WHERE payment_id = NEW.payment_id
      AND (is_deleted = false OR is_deleted IS NULL);

    IF total_order > total_accrual THEN
      RAISE EXCEPTION 'Cannot confirm payment_id=%: due (total_order) exceeds balance (total_accrual)', NEW.payment_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_prevent_confirm_due_gt_balance ON public.payments_ledger;
CREATE TRIGGER trigger_prevent_confirm_due_gt_balance
  BEFORE UPDATE ON public.payments_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_confirm_when_due_gt_balance();
