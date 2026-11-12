/**
 * Verification and Fix Script for GE21BG0000000611354669 Account Visibility
 * 
 * This script ensures the GE21 account is properly configured to appear in counteragent statements.
 * 
 * Run this in Supabase SQL editor against production database to verify/fix GE21 visibility.
 * 
 * Expected outcome:
 * - GE21 account exists in bank_accounts with is_active = true
 * - raw_table_name is set to "GE21BG0000000611354669_BOG_GEL"
 * - insider_uuid matches the primary active BOG insider
 * - Raw table "GE21BG0000000611354669_BOG_GEL" exists (check schema after running)
 */

-- Step 1: Verify GE21 account exists and is discoverable
SELECT 
  bank_account_uuid,
  account_number,
  iban,
  raw_table_name,
  is_active,
  insider_uuid,
  currency_uuid,
  created_at,
  updated_at
FROM bank_accounts
WHERE account_number = 'GE21BG0000000611354669' 
   OR iban = 'GE21BG0000000611354669'
LIMIT 1;

-- Step 2: Find the primary active BOG insider (should have most BOG accounts)
SELECT 
  ba.insider_uuid,
  COUNT(*) as count
FROM bank_accounts ba
JOIN banks b ON ba.bank_uuid = b.uuid
WHERE b.code = 'BOG' AND ba.is_active = true
GROUP BY ba.insider_uuid
ORDER BY count DESC
LIMIT 1;

-- Step 3: Ensure GE21 is active and has correct configuration
-- UNCOMMENT AND RUN ONLY IF NEEDED to fix the account:
/*
UPDATE bank_accounts
SET 
  is_active = true,
  raw_table_name = 'GE21BG0000000611354669_BOG_GEL',
  insider_uuid = (
    SELECT insider_uuid FROM bank_accounts
    WHERE bank_uuid = (SELECT uuid FROM banks WHERE code = 'BOG')
    AND is_active = true
    GROUP BY insider_uuid
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
WHERE account_number = 'GE21BG0000000611354669' 
   OR iban = 'GE21BG0000000611354669';
*/

-- Step 4: Verify raw table can be queried
-- This will return row count if table exists
SELECT COUNT(*) as row_count FROM "GE21BG0000000611354669_BOG_GEL";

-- Step 5: Verify account appears in getSourceTables() results
-- (This runs the same logic as the application's getSourceTables function)
SELECT raw_table_name FROM bank_accounts 
WHERE raw_table_name IS NOT NULL 
  AND raw_table_name <> '' 
  AND is_active = true
ORDER BY id
