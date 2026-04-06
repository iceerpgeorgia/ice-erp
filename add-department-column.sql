ALTER TABLE counteragents ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE counteragents DROP CONSTRAINT IF EXISTS chk_department_values;
ALTER TABLE counteragents ADD CONSTRAINT chk_department_values
  CHECK (department IS NULL OR department IN ('Tbilisi', 'Batumi', 'Administration'));

-- Default existing employees to 'Administration' so we can add the mandatory constraint
UPDATE counteragents SET department = 'Administration' WHERE is_emploee = true AND department IS NULL;

ALTER TABLE counteragents DROP CONSTRAINT IF EXISTS chk_employee_department;
ALTER TABLE counteragents ADD CONSTRAINT chk_employee_department
  CHECK (NOT is_emploee OR department IS NOT NULL);
