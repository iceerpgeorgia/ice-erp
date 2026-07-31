-- ============================================================================
-- TRIGGER: Automatically populate project_uuid and financial_code_uuid
-- ============================================================================
-- This trigger ensures that whenever a bank transaction is inserted or updated
-- with a payment_id that exists in the payments table, the transaction's
-- project_uuid and financial_code_uuid are automatically synced from the payment.
--
-- Purpose: Prevent transactions from having NULL project_uuid when their linked
-- payment has a non-NULL project_uuid. This ensures all transactions are visible
-- in the API filtering by project_uuid.
--
-- Applies to: All raw bank account tables (BOG_GEL, TBC_GEL, BOG_USD, etc.)

-- Note: In PostgreSQL, we'll create a function and attach it to multiple tables
-- using BEFORE INSERT OR UPDATE triggers

CREATE OR REPLACE FUNCTION sync_transaction_project_from_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment_id is provided and project_uuid is NULL, sync from payment
  IF NEW.payment_id IS NOT NULL AND NEW.project_uuid IS NULL THEN
    SELECT project_uuid, financial_code_uuid INTO NEW.project_uuid, NEW.financial_code_uuid
    FROM payments
    WHERE payment_id = NEW.payment_id
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to BOG_GEL
DROP TRIGGER IF EXISTS sync_project_from_payment_bog_gel ON "GE78BG0000000893486000_BOG_GEL";
CREATE TRIGGER sync_project_from_payment_bog_gel
BEFORE INSERT OR UPDATE ON "GE78BG0000000893486000_BOG_GEL"
FOR EACH ROW
EXECUTE FUNCTION sync_transaction_project_from_payment();

-- Attach trigger to TBC_GEL
DROP TRIGGER IF EXISTS sync_project_from_payment_tbc_gel ON "GE65TB7856036050100002_TBC_GEL";
CREATE TRIGGER sync_project_from_payment_tbc_gel
BEFORE INSERT OR UPDATE ON "GE65TB7856036050100002_TBC_GEL"
FOR EACH ROW
EXECUTE FUNCTION sync_transaction_project_from_payment();

-- Attach trigger to BOG_USD
DROP TRIGGER IF EXISTS sync_project_from_payment_bog_usd ON "GE78BG0000000893486000_BOG_USD";
CREATE TRIGGER sync_project_from_payment_bog_usd
BEFORE INSERT OR UPDATE ON "GE78BG0000000893486000_BOG_USD"
FOR EACH ROW
EXECUTE FUNCTION sync_transaction_project_from_payment();

-- Additional BOG currencies (if they exist, the trigger creation will fail silently)
-- Feel free to add more tables as needed

COMMIT;
