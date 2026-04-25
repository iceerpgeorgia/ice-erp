-- jobs table is missing the factory_no column referenced in all API queries.
-- This column stores the factory/serial number for an elevator job.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS factory_no TEXT;
