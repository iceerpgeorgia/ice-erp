-- Force update payment #4226 to use proper formats
UPDATE payments 
SET 
  payment_id = substring(md5(random()::text) from 1 for 6) || '_' || 
               substring(md5(random()::text) from 1 for 2) || '_' || 
               substring(md5(random()::text) from 1 for 6),
  record_uuid = gen_random_uuid()::text
WHERE id = 4226;

-- Verify the fix
SELECT id, payment_id, record_uuid FROM payments WHERE id = 4226;
