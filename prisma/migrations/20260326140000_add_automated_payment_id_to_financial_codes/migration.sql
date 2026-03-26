-- Add automated_payment_id boolean to financial_codes
-- When true, project creation with this financial code will auto-create a project-derived payment

ALTER TABLE financial_codes ADD COLUMN automated_payment_id BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_financial_codes_automated_payment_id ON financial_codes (automated_payment_id) WHERE automated_payment_id = true;
