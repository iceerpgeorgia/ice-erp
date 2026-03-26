-- Add is_project_derived column to payments table
-- Project-derived payments are auto-created when a project is registered
-- and kept in sync with the project's parameters.
ALTER TABLE "payments" ADD COLUMN "is_project_derived" BOOLEAN NOT NULL DEFAULT false;

-- Index for quick lookups when syncing project changes
CREATE INDEX "payments_is_project_derived_idx" ON "payments"("is_project_derived") WHERE "is_project_derived" = true;
