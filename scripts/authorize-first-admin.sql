-- Authorize a user after deployment
-- Run this in your Supabase SQL Editor or database console

-- Replace 'user@example.com' with the actual email
UPDATE "User" 
SET 
  "isAuthorized" = true,
  "role" = 'system_admin',
  "authorizedBy" = 'system',
  "authorizedAt" = NOW()
WHERE email = 'iceerpgeorgia@gmail.com';

-- Verify the update
SELECT id, email, role, "isAuthorized", "authorizedAt", "authorizedBy"
FROM "User"
WHERE email = 'iceerpgeorgia@gmail.com';
