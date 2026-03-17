BEGIN;

DO $$
DECLARE
  v_bank_uuid uuid;
  v_ccy_gel uuid;
  v_ccy_usd uuid;
  v_ccy_eur uuid;
  v_scheme_gel uuid;
  v_scheme_usd uuid;
  v_scheme_eur uuid;
  v_default_insider uuid;
  v_template_table text;
  v_table text;
BEGIN
  -- Resolve TBC bank UUID once.
  SELECT b.uuid
  INTO v_bank_uuid
  FROM banks b
  WHERE UPPER(COALESCE(b.bank_name, '')) LIKE '%TBC%'
  ORDER BY CASE WHEN UPPER(b.bank_name) = 'TBC' THEN 0 ELSE 1 END, b.id
  LIMIT 1;

  IF v_bank_uuid IS NULL THEN
    RAISE EXCEPTION 'TBC bank not found in banks table';
  END IF;

  SELECT c.uuid INTO v_ccy_gel FROM currencies c WHERE UPPER(c.code) = 'GEL' LIMIT 1;
  SELECT c.uuid INTO v_ccy_usd FROM currencies c WHERE UPPER(c.code) = 'USD' LIMIT 1;
  SELECT c.uuid INTO v_ccy_eur FROM currencies c WHERE UPPER(c.code) = 'EUR' LIMIT 1;

  IF v_ccy_gel IS NULL OR v_ccy_usd IS NULL OR v_ccy_eur IS NULL THEN
    RAISE EXCEPTION 'Required currencies GEL/USD/EUR must exist before this migration';
  END IF;

  INSERT INTO parsing_schemes (scheme)
  VALUES ('TBC_GEL')
  ON CONFLICT (scheme) DO NOTHING;

  INSERT INTO parsing_schemes (scheme)
  VALUES ('TBC_USD')
  ON CONFLICT (scheme) DO NOTHING;

  INSERT INTO parsing_schemes (scheme)
  VALUES ('TBC_EUR')
  ON CONFLICT (scheme) DO NOTHING;

  SELECT uuid INTO v_scheme_gel FROM parsing_schemes WHERE scheme = 'TBC_GEL' LIMIT 1;
  SELECT uuid INTO v_scheme_usd FROM parsing_schemes WHERE scheme = 'TBC_USD' LIMIT 1;
  SELECT uuid INTO v_scheme_eur FROM parsing_schemes WHERE scheme = 'TBC_EUR' LIMIT 1;

  -- Use insider from existing core TBC GEL account when available.
  SELECT ba.insider_uuid
  INTO v_default_insider
  FROM bank_accounts ba
  WHERE ba.account_number = 'GE65TB7856036050100002'
    AND ba.insider_uuid IS NOT NULL
  ORDER BY ba.updated_at DESC NULLS LAST, ba.created_at DESC NULLS LAST, ba.id DESC
  LIMIT 1;

  -- Account discovered in XML: GE39TB7856036150100001 USD
  INSERT INTO bank_accounts (
    account_number,
    currency_uuid,
    bank_uuid,
    parsing_scheme_uuid,
    raw_table_name,
    insider_uuid,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    'GE39TB7856036150100001',
    v_ccy_usd,
    v_bank_uuid,
    v_scheme_usd,
    'GE39TB7856036150100001_TBC_USD',
    v_default_insider,
    true,
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1
    FROM bank_accounts ba
    WHERE ba.account_number = 'GE39TB7856036150100001'
      AND ba.currency_uuid = v_ccy_usd
  );

  UPDATE bank_accounts
  SET
    bank_uuid = COALESCE(bank_uuid, v_bank_uuid),
    parsing_scheme_uuid = COALESCE(parsing_scheme_uuid, v_scheme_usd),
    raw_table_name = COALESCE(raw_table_name, 'GE39TB7856036150100001_TBC_USD'),
    updated_at = NOW()
  WHERE account_number = 'GE39TB7856036150100001'
    AND currency_uuid = v_ccy_usd;

  -- Account discovered in XML: GE39TB7856036150100001 EUR
  INSERT INTO bank_accounts (
    account_number,
    currency_uuid,
    bank_uuid,
    parsing_scheme_uuid,
    raw_table_name,
    insider_uuid,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    'GE39TB7856036150100001',
    v_ccy_eur,
    v_bank_uuid,
    v_scheme_eur,
    'GE39TB7856036150100001_TBC_EUR',
    v_default_insider,
    true,
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1
    FROM bank_accounts ba
    WHERE ba.account_number = 'GE39TB7856036150100001'
      AND ba.currency_uuid = v_ccy_eur
  );

  UPDATE bank_accounts
  SET
    bank_uuid = COALESCE(bank_uuid, v_bank_uuid),
    parsing_scheme_uuid = COALESCE(parsing_scheme_uuid, v_scheme_eur),
    raw_table_name = COALESCE(raw_table_name, 'GE39TB7856036150100001_TBC_EUR'),
    updated_at = NOW()
  WHERE account_number = 'GE39TB7856036150100001'
    AND currency_uuid = v_ccy_eur;

  -- Account discovered in XML: GE79TB7856045067800004 GEL
  INSERT INTO bank_accounts (
    account_number,
    currency_uuid,
    bank_uuid,
    parsing_scheme_uuid,
    raw_table_name,
    insider_uuid,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    'GE79TB7856045067800004',
    v_ccy_gel,
    v_bank_uuid,
    v_scheme_gel,
    'GE79TB7856045067800004_TBC_GEL',
    v_default_insider,
    true,
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1
    FROM bank_accounts ba
    WHERE ba.account_number = 'GE79TB7856045067800004'
      AND ba.currency_uuid = v_ccy_gel
  );

  UPDATE bank_accounts
  SET
    bank_uuid = COALESCE(bank_uuid, v_bank_uuid),
    parsing_scheme_uuid = COALESCE(parsing_scheme_uuid, v_scheme_gel),
    raw_table_name = COALESCE(raw_table_name, 'GE79TB7856045067800004_TBC_GEL'),
    updated_at = NOW()
  WHERE account_number = 'GE79TB7856045067800004'
    AND currency_uuid = v_ccy_gel;

  -- Account discovered in XML: GE52TB7856045067800005 GEL
  INSERT INTO bank_accounts (
    account_number,
    currency_uuid,
    bank_uuid,
    parsing_scheme_uuid,
    raw_table_name,
    insider_uuid,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    'GE52TB7856045067800005',
    v_ccy_gel,
    v_bank_uuid,
    v_scheme_gel,
    'GE52TB7856045067800005_TBC_GEL',
    v_default_insider,
    true,
    NOW(),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1
    FROM bank_accounts ba
    WHERE ba.account_number = 'GE52TB7856045067800005'
      AND ba.currency_uuid = v_ccy_gel
  );

  UPDATE bank_accounts
  SET
    bank_uuid = COALESCE(bank_uuid, v_bank_uuid),
    parsing_scheme_uuid = COALESCE(parsing_scheme_uuid, v_scheme_gel),
    raw_table_name = COALESCE(raw_table_name, 'GE52TB7856045067800005_TBC_GEL'),
    updated_at = NOW()
  WHERE account_number = 'GE52TB7856045067800005'
    AND currency_uuid = v_ccy_gel;

  -- Clone table structure from an existing TBC table.
  SELECT t.table_name
  INTO v_template_table
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name = 'GE65TB7856036050100002_TBC_GEL'
  LIMIT 1;

  IF v_template_table IS NULL THEN
    SELECT t.table_name
    INTO v_template_table
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name LIKE '%_TBC_%'
    ORDER BY t.table_name
    LIMIT 1;
  END IF;

  IF v_template_table IS NULL THEN
    RAISE EXCEPTION 'No existing TBC deconsolidated table found to clone from';
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'GE39TB7856036150100001_TBC_USD',
    'GE39TB7856036150100001_TBC_EUR',
    'GE79TB7856045067800004_TBC_GEL',
    'GE52TB7856045067800005_TBC_GEL'
  ]
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I (LIKE %I INCLUDING ALL)',
      v_table,
      v_template_table
    );
  END LOOP;
END;
$$;

COMMIT;
