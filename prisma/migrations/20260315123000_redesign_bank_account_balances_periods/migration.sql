BEGIN;

DROP TABLE IF EXISTS bank_account_balances;

CREATE TABLE bank_account_balances (
  id bigserial PRIMARY KEY,
  account_uuid uuid NOT NULL REFERENCES bank_accounts(uuid) ON DELETE CASCADE,
  opening_date date NOT NULL,
  opening_balance numeric(20,2) NOT NULL,
  inflow numeric(20,2) NOT NULL DEFAULT 0,
  outflow numeric(20,2) NOT NULL DEFAULT 0,
  closing_date date NOT NULL,
  closing_balance numeric(20,2) GENERATED ALWAYS AS (opening_balance + inflow - outflow) STORED,
  CONSTRAINT chk_bank_account_balances_positive_flows CHECK (inflow >= 0 AND outflow >= 0),
  CONSTRAINT chk_bank_account_balances_period CHECK (closing_date > opening_date),
  CONSTRAINT uq_bank_account_balances_account_opening_date UNIQUE (account_uuid, opening_date)
);

CREATE INDEX idx_bank_account_balances_account_uuid
  ON bank_account_balances(account_uuid);

CREATE INDEX idx_bank_account_balances_opening_date
  ON bank_account_balances(opening_date);

CREATE INDEX idx_bank_account_balances_closing_date
  ON bank_account_balances(closing_date);

CREATE OR REPLACE FUNCTION get_bank_account_uuid_for_raw_table(p_table_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  WITH candidates AS (
    SELECT
      ba.uuid,
      ba.raw_table_name,
      ba.account_number,
      UPPER(COALESCE(c.code, 'GEL')) AS currency_code,
      UPPER(COALESCE(b.bank_name, '')) AS bank_name
    FROM bank_accounts ba
    LEFT JOIN currencies c ON c.uuid = ba.currency_uuid
    LEFT JOIN banks b ON b.uuid = ba.bank_uuid
  )
  SELECT c.uuid
  FROM candidates c
  WHERE
    c.raw_table_name = p_table_name
    OR (
      c.bank_name = 'BOG'
      AND p_table_name = c.account_number || '_BOG_' || c.currency_code
    )
    OR (
      c.bank_name = 'TBC'
      AND p_table_name = c.account_number || '_TBC_' || c.currency_code
    )
  ORDER BY
    CASE WHEN c.raw_table_name = p_table_name THEN 0 ELSE 1 END,
    c.uuid
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION recompute_bank_account_balance_periods(
  p_account_uuid uuid,
  p_from_date date DEFAULT DATE '2018-01-01',
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_name text;
  v_start_balance numeric(20,2) := 0;
  v_day record;
  v_opening_balance numeric(20,2) := 0;
  v_in_zero_segment boolean := false;
  v_segment_start date;
  v_segment_opening_balance numeric(20,2);
  v_today date := CURRENT_DATE;
BEGIN
  IF p_to_date < p_from_date THEN
    RAISE EXCEPTION 'Invalid range: % < %', p_to_date, p_from_date;
  END IF;

  SELECT
    COALESCE(ba.balance, 0)::numeric(20,2),
    COALESCE(
      ba.raw_table_name,
      CASE
        WHEN UPPER(COALESCE(b.bank_name, '')) = 'BOG' THEN ba.account_number || '_BOG_' || UPPER(COALESCE(c.code, 'GEL'))
        WHEN UPPER(COALESCE(b.bank_name, '')) = 'TBC' THEN ba.account_number || '_TBC_' || UPPER(COALESCE(c.code, 'GEL'))
        ELSE NULL
      END
    )
  INTO v_start_balance, v_table_name
  FROM bank_accounts ba
  LEFT JOIN banks b ON b.uuid = ba.bank_uuid
  LEFT JOIN currencies c ON c.uuid = ba.currency_uuid
  WHERE ba.uuid = p_account_uuid;

  IF v_table_name IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve deconsolidated table name for account_uuid=%', p_account_uuid;
  END IF;

  -- If we are recomputing from inside an existing timeline, reuse the already known opening balance at p_from_date.
  SELECT bab.opening_balance
  INTO v_opening_balance
  FROM bank_account_balances bab
  WHERE bab.account_uuid = p_account_uuid
    AND bab.opening_date <= p_from_date
    AND bab.closing_date > p_from_date
  ORDER BY bab.opening_date DESC
  LIMIT 1;

  IF v_opening_balance IS NULL THEN
    v_opening_balance := v_start_balance;
  END IF;

  -- Remove only the affected suffix, preserving periods before p_from_date.
  DELETE FROM bank_account_balances
  WHERE account_uuid = p_account_uuid
    AND closing_date > p_from_date;

  CREATE TEMP TABLE tmp_turnovers (
    day date PRIMARY KEY,
    inflow numeric(20,2) NOT NULL,
    outflow numeric(20,2) NOT NULL
  ) ON COMMIT DROP;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = v_table_name
      AND column_name IN ('transaction_date', 'account_currency_amount')
    GROUP BY table_name
    HAVING COUNT(*) = 2
  ) THEN
    EXECUTE format(
      'INSERT INTO tmp_turnovers(day, inflow, outflow)
       SELECT
         transaction_date::date AS day,
         COALESCE(SUM(CASE WHEN account_currency_amount > 0 THEN account_currency_amount ELSE 0 END), 0)::numeric(20,2) AS inflow,
         COALESCE(SUM(CASE WHEN account_currency_amount < 0 THEN ABS(account_currency_amount) ELSE 0 END), 0)::numeric(20,2) AS outflow
       FROM %I
       WHERE transaction_date::date BETWEEN $1 AND $2
       GROUP BY transaction_date::date',
      v_table_name
    )
    USING p_from_date, p_to_date;
  END IF;

  FOR v_day IN
    SELECT
      gs::date AS day,
      COALESCE(tt.inflow, 0)::numeric(20,2) AS inflow,
      COALESCE(tt.outflow, 0)::numeric(20,2) AS outflow
    FROM generate_series(p_from_date, p_to_date, INTERVAL '1 day') gs
    LEFT JOIN tmp_turnovers tt ON tt.day = gs::date
    ORDER BY gs
  LOOP
    IF v_day.inflow = 0 AND v_day.outflow = 0 THEN
      IF NOT v_in_zero_segment THEN
        v_in_zero_segment := true;
        v_segment_start := v_day.day;
        v_segment_opening_balance := v_opening_balance;
      END IF;
    ELSE
      IF v_in_zero_segment THEN
        INSERT INTO bank_account_balances(
          account_uuid,
          opening_date,
          opening_balance,
          inflow,
          outflow,
          closing_date
        ) VALUES (
          p_account_uuid,
          v_segment_start,
          v_segment_opening_balance,
          0,
          0,
          v_day.day
        );

        v_in_zero_segment := false;
      END IF;

      INSERT INTO bank_account_balances(
        account_uuid,
        opening_date,
        opening_balance,
        inflow,
        outflow,
        closing_date
      ) VALUES (
        p_account_uuid,
        v_day.day,
        v_opening_balance,
        v_day.inflow,
        v_day.outflow,
        v_day.day + 1
      );
    END IF;

    v_opening_balance := (v_opening_balance + v_day.inflow - v_day.outflow)::numeric(20,2);
  END LOOP;

  IF v_in_zero_segment THEN
    INSERT INTO bank_account_balances(
      account_uuid,
      opening_date,
      opening_balance,
      inflow,
      outflow,
      closing_date
    ) VALUES (
      p_account_uuid,
      v_segment_start,
      v_segment_opening_balance,
      0,
      0,
      p_to_date + 1
    );
  END IF;
END;
$$;

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

  PERFORM recompute_bank_account_balance_periods(v_account_uuid, v_from_date, CURRENT_DATE);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name NOT LIKE 'pg_%'
      AND column_name IN ('transaction_date', 'account_currency_amount')
      AND (
        table_name LIKE '%_BOG_%'
        OR table_name LIKE '%_TBC_%'
      )
    GROUP BY table_name
    HAVING COUNT(*) = 2
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_recompute_bank_balances ON %I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_recompute_bank_balances
       AFTER INSERT OR UPDATE OR DELETE ON %I
       FOR EACH ROW
       EXECUTE FUNCTION trg_recompute_bank_account_balance_periods_from_raw()',
      r.table_name
    );
  END LOOP;
END $$;

COMMIT;
