-- Prevent deletion of payments that have active ledger entries,
-- adjustments, or bank transactions attached.
-- This is a database-level safety net on top of the API guards.

CREATE OR REPLACE FUNCTION prevent_payment_delete_with_transactions()
RETURNS TRIGGER AS $$
DECLARE
  has_ledger BOOLEAN;
  has_adjustments BOOLEAN;
  has_bank_txns BOOLEAN;
BEGIN
  -- Check for active ledger entries
  SELECT EXISTS (
    SELECT 1 FROM payments_ledger pl
    WHERE pl.payment_id = OLD.payment_id
      AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
      AND (COALESCE(pl.accrual, 0) <> 0 OR COALESCE(pl."order", 0) <> 0)
  ) INTO has_ledger;

  IF has_ledger THEN
    RAISE EXCEPTION 'Cannot delete payment "%": it has active ledger entries. Remove them first.',
      OLD.payment_id;
  END IF;

  -- Check for active adjustments
  SELECT EXISTS (
    SELECT 1 FROM payment_adjustments pa
    WHERE pa.payment_id = OLD.payment_id
      AND (pa.is_deleted = false OR pa.is_deleted IS NULL)
  ) INTO has_adjustments;

  IF has_adjustments THEN
    RAISE EXCEPTION 'Cannot delete payment "%": it has active adjustments. Remove them first.',
      OLD.payment_id;
  END IF;

  -- Check for bank transactions in raw tables
  SELECT EXISTS (
    SELECT 1 FROM "GE78BG0000000893486000_BOG_GEL" r
    WHERE r.payment_id = OLD.payment_id
    LIMIT 1
  ) INTO has_bank_txns;

  IF NOT has_bank_txns THEN
    SELECT EXISTS (
      SELECT 1 FROM "GE65TB7856036050100002_TBC_GEL" r
      WHERE r.payment_id = OLD.payment_id
      LIMIT 1
    ) INTO has_bank_txns;
  END IF;

  IF NOT has_bank_txns THEN
    SELECT EXISTS (
      SELECT 1 FROM bank_transaction_batches btb
      WHERE btb.payment_id = OLD.payment_id
      LIMIT 1
    ) INTO has_bank_txns;
  END IF;

  IF has_bank_txns THEN
    RAISE EXCEPTION 'Cannot delete payment "%": it has attached bank transactions. Unlink them first.',
      OLD.payment_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to payments table (BEFORE DELETE to block the operation)
DROP TRIGGER IF EXISTS trigger_prevent_payment_delete_with_transactions ON payments;

CREATE TRIGGER trigger_prevent_payment_delete_with_transactions
  BEFORE DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_payment_delete_with_transactions();


-- Prevent deletion of projects that have payments with attached transactions.
-- The project itself doesn't cascade-delete payments, but this is a safety net
-- to block deletion if ANY payment (project-derived or otherwise) linked to this
-- project has transactions.

CREATE OR REPLACE FUNCTION prevent_project_delete_with_transactions()
RETURNS TRIGGER AS $$
DECLARE
  blocking_payment_id TEXT;
BEGIN
  -- Find any payment linked to this project that has ledger, adjustments, or bank txns
  SELECT p.payment_id INTO blocking_payment_id
  FROM payments p
  WHERE p.project_uuid = OLD.project_uuid
    AND p.is_active = true
    AND (
      EXISTS (
        SELECT 1 FROM payments_ledger pl
        WHERE pl.payment_id = p.payment_id
          AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
          AND (COALESCE(pl.accrual, 0) <> 0 OR COALESCE(pl."order", 0) <> 0)
      )
      OR EXISTS (
        SELECT 1 FROM payment_adjustments pa
        WHERE pa.payment_id = p.payment_id
          AND (pa.is_deleted = false OR pa.is_deleted IS NULL)
      )
      OR EXISTS (
        SELECT 1 FROM "GE78BG0000000893486000_BOG_GEL" r
        WHERE r.payment_id = p.payment_id
      )
      OR EXISTS (
        SELECT 1 FROM "GE65TB7856036050100002_TBC_GEL" r
        WHERE r.payment_id = p.payment_id
      )
      OR EXISTS (
        SELECT 1 FROM bank_transaction_batches btb
        WHERE btb.payment_id = p.payment_id
      )
    )
  LIMIT 1;

  IF blocking_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete project: payment "%" has attached transactions. Remove them first.',
      blocking_payment_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to projects table
DROP TRIGGER IF EXISTS trigger_prevent_project_delete_with_transactions ON projects;

CREATE TRIGGER trigger_prevent_project_delete_with_transactions
  BEFORE DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION prevent_project_delete_with_transactions();
