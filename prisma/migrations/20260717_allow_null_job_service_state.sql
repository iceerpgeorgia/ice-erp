-- Remove the check constraint that restricts service_state to enum values
-- This allows us to set service_state to NULL or other values

ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_service_state_check;

-- Make service_state nullable by allowing NULL values
-- (It's already declared as optional in Prisma schema)

UPDATE jobs SET service_state = NULL;
