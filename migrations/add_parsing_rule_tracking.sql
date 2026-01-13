-- Migration: Add active flag to parsing_scheme_rules and applied_rule_id to raw tables and consolidated table

-- Add active column to parsing_scheme_rules (default TRUE for existing rules)
ALTER TABLE parsing_scheme_rules 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- Update all existing rules to be active
UPDATE parsing_scheme_rules SET active = TRUE WHERE active IS NULL;

-- Add applied_rule_id to bog_gel_raw_893486000
ALTER TABLE bog_gel_raw_893486000
ADD COLUMN IF NOT EXISTS applied_rule_id INTEGER;

-- Add applied_rule_id to consolidated_bank_accounts
ALTER TABLE consolidated_bank_accounts
ADD COLUMN IF NOT EXISTS applied_rule_id INTEGER;

-- Add foreign key constraint (optional, but recommended)
-- ALTER TABLE bog_gel_raw_893486000
-- ADD CONSTRAINT fk_applied_rule FOREIGN KEY (applied_rule_id) 
-- REFERENCES parsing_scheme_rules(id);

-- ALTER TABLE consolidated_bank_accounts
-- ADD CONSTRAINT fk_applied_rule FOREIGN KEY (applied_rule_id) 
-- REFERENCES parsing_scheme_rules(id);

COMMENT ON COLUMN parsing_scheme_rules.active IS 'Whether this rule is active and should be applied during processing';
COMMENT ON COLUMN bog_gel_raw_893486000.applied_rule_id IS 'ID of the parsing rule that was applied to this record';
COMMENT ON COLUMN consolidated_bank_accounts.applied_rule_id IS 'ID of the parsing rule that was applied to this record';

