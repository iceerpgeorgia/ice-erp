-- Add label column to payments table

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS label TEXT;
