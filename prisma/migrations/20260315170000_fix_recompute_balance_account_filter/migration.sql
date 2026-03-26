BEGIN;

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
      AND column_name IN ('transaction_date', 'account_currency_amount', 'bank_account_uuid')
    GROUP BY table_name
    HAVING COUNT(*) = 3
  ) THEN
    EXECUTE format(
      'INSERT INTO tmp_turnovers(day, inflow, outflow)
       SELECT
         transaction_date::date AS day,
         COALESCE(SUM(CASE WHEN account_currency_amount > 0 THEN account_currency_amount ELSE 0 END), 0)::numeric(20,2) AS inflow,
         COALESCE(SUM(CASE WHEN account_currency_amount < 0 THEN ABS(account_currency_amount) ELSE 0 END), 0)::numeric(20,2) AS outflow
       FROM %I
       WHERE transaction_date::date BETWEEN $1 AND $2
         AND bank_account_uuid::text = $3
       GROUP BY transaction_date::date',
      v_table_name
    )
    USING p_from_date, p_to_date, p_account_uuid::text;
  ELSIF EXISTS (
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

COMMIT;
