ALTER TABLE entity_types
  DROP COLUMN IF EXISTS code;

DROP INDEX IF EXISTS entity_types_code_key;
