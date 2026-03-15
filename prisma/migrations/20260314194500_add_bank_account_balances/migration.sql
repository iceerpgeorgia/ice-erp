BEGIN;

CREATE TABLE IF NOT EXISTS bank_account_balances (
  "date" date NOT NULL,
  account_uuid uuid NOT NULL,
  balance numeric(20,2) NOT NULL,
  CONSTRAINT bank_account_balances_pkey PRIMARY KEY ("date", account_uuid),
  CONSTRAINT bank_account_balances_account_uuid_fkey
    FOREIGN KEY (account_uuid)
    REFERENCES bank_accounts(uuid)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bank_account_balances_account_uuid
  ON bank_account_balances(account_uuid);

CREATE INDEX IF NOT EXISTS idx_bank_account_balances_date
  ON bank_account_balances("date");

COMMIT;
