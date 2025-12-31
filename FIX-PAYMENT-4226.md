# Fix Payment #4226 on Supabase Production

## Problem
Payment #4226 was created in production but `payment_id` and `record_uuid` were not generated because the database trigger was not installed.

## Solution - Run This Command

### Option 1: Using Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: **fojbzghphznbslqwurrm**
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Paste and run this SQL:

```sql
-- 1. Install helper function for record_uuid generation
CREATE OR REPLACE FUNCTION generate_custom_record_uuid()
RETURNS TEXT AS $$
DECLARE
  hex_chars TEXT := '0123456789abcdef';
  result TEXT := '';
  i INT;
  random_val INT;
BEGIN
  FOR i IN 1..6 LOOP
    random_val := floor(random() * 16)::INT;
    result := result || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  result := result || '_';
  
  FOR i IN 1..2 LOOP
    random_val := floor(random() * 16)::INT;
    result := result || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  result := result || '_';
  
  FOR i IN 1..4 LOOP
    random_val := floor(random() * 16)::INT;
    result := result || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Install trigger function
CREATE OR REPLACE FUNCTION generate_payment_id()
RETURNS TRIGGER AS $$
DECLARE
  hex_chars TEXT := '0123456789abcdef';
  new_payment_id TEXT := '';
  i INT;
  random_val INT;
BEGIN
  -- Generate 6 random hex characters
  FOR i IN 1..6 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  new_payment_id := new_payment_id || '_';
  
  FOR i IN 1..2 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  new_payment_id := new_payment_id || '_';
  
  FOR i IN 1..4 LOOP
    random_val := floor(random() * 16)::INT;
    new_payment_id := new_payment_id || substr(hex_chars, random_val + 1, 1);
  END LOOP;
  
  NEW.payment_id := new_payment_id;
  NEW.record_uuid := generate_custom_record_uuid();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to payments table
DROP TRIGGER IF EXISTS payment_id_trigger ON payments;
CREATE TRIGGER payment_id_trigger
  BEFORE INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.payment_id IS NULL OR NEW.payment_id = '')
  EXECUTE FUNCTION generate_payment_id();

-- 4. Backfill payment #4226 (generate IDs manually)
UPDATE payments 
SET 
  payment_id = substring(md5(random()::text) from 1 for 6) || '_' || 
               substring(md5(random()::text) from 1 for 2) || '_' || 
               substring(md5(random()::text) from 1 for 4),
  record_uuid = substring(md5(random()::text) from 1 for 6) || '_' || 
                substring(md5(random()::text) from 1 for 2) || '_' || 
                substring(md5(random()::text) from 1 for 4)
WHERE id = 4226 
AND (payment_id IS NULL OR payment_id = '' OR record_uuid IS NULL OR record_uuid = '');

-- 5. Verify payment #4226
SELECT id, payment_id, record_uuid FROM payments WHERE id = 4226;
```

### Option 2: Using Local Script Against Production

1. **Set production DATABASE_URL** (get the real password from Vercel dashboard):
   ```powershell
   $env:DATABASE_URL="postgresql://postgres.fojbzghphznbslqwurrm:REAL_PASSWORD@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
   ```

2. **Run the setup script**:
   ```powershell
   node scripts/setup-payment-ids.js
   ```

   This will:
   - ✅ Check if trigger exists
   - ✅ Install trigger if missing
   - ✅ Backfill all payments with missing IDs (including #4226)
   - ✅ Verify payment #4226 has IDs

## What This Does

1. **Installs trigger function** - Auto-generates `payment_id` and `record_uuid` for new payments
2. **Attaches trigger to table** - Runs before INSERT when IDs are empty
3. **Backfills payment #4226** - Generates missing IDs for existing payment
4. **Verifies fix** - Checks that payment #4226 now has both IDs

## After Running

All new payments will automatically get:
- `payment_id` (format: `a1b2c3_4d_5e6f`)
- `record_uuid` (format: `a1b2c3_4d_5e6f`)

Payment #4226 will have its missing IDs filled in.
