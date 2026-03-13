-- Allow multiple insider counteragents by removing single-true unique constraint.
DROP INDEX IF EXISTS uq_single_true_insider;
