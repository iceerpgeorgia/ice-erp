-- Add unique constraint to counteragent_uuid column
-- This prevents duplicate counteragent_uuid values

ALTER TABLE counteragents 
ADD CONSTRAINT counteragents_counteragent_uuid_key 
UNIQUE (counteragent_uuid);
