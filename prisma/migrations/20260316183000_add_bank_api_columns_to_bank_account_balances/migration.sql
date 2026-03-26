BEGIN;

ALTER TABLE bank_account_balances
  ADD COLUMN IF NOT EXISTS opening_balance_bank_api numeric(20,2),
  ADD COLUMN IF NOT EXISTS inflow_bank_api numeric(20,2),
  ADD COLUMN IF NOT EXISTS outflow_bank_api numeric(20,2),
  ADD COLUMN IF NOT EXISTS closing_balance_bank_api numeric(20,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_bank_account_balances_api_flows_non_negative'
      AND conrelid = 'bank_account_balances'::regclass
  ) THEN
    ALTER TABLE bank_account_balances
      ADD CONSTRAINT chk_bank_account_balances_api_flows_non_negative
      CHECK (
        (inflow_bank_api IS NULL OR inflow_bank_api >= 0)
        AND (outflow_bank_api IS NULL OR outflow_bank_api >= 0)
      );
  END IF;
END;
$$;

COMMENT ON COLUMN bank_account_balances.opening_balance_bank_api
  IS 'Opening balance from bank API (or API-derived cache) for the covered period.';
COMMENT ON COLUMN bank_account_balances.inflow_bank_api
  IS 'Total inflow from bank API (or API-derived cache) for the covered period.';
COMMENT ON COLUMN bank_account_balances.outflow_bank_api
  IS 'Total outflow from bank API (or API-derived cache) for the covered period.';
COMMENT ON COLUMN bank_account_balances.closing_balance_bank_api
  IS 'Closing balance from bank API (or API-derived cache) for the covered period.';

COMMIT;
