const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // 1. Trigger: prevent soft-deleting a job (is_active = false) if payments reference it
  await p.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION prevent_job_deactivation_with_payments()
    RETURNS TRIGGER AS $$
    BEGIN
      IF OLD.is_active = true AND NEW.is_active = false THEN
        IF EXISTS (
          SELECT 1 FROM payments
          WHERE job_uuid = OLD.job_uuid
            AND is_active = true
        ) THEN
          RAISE EXCEPTION 'Cannot deactivate job "%" (%) — it has active payments linked to it. Remove or reassign the payments first.',
            OLD.job_name, OLD.job_uuid;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('Created function prevent_job_deactivation_with_payments');

  await p.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS trg_prevent_job_deactivation_with_payments ON jobs;
  `);

  await p.$executeRawUnsafe(`
    CREATE TRIGGER trg_prevent_job_deactivation_with_payments
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_job_deactivation_with_payments();
  `);
  console.log('Created trigger trg_prevent_job_deactivation_with_payments on jobs');

  // 2. Trigger: prevent deleting job_projects binding if payments reference the job for that project
  await p.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION prevent_job_project_unbind_with_payments()
    RETURNS TRIGGER AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM payments
        WHERE job_uuid = OLD.job_uuid
          AND project_uuid = OLD.project_uuid
          AND is_active = true
      ) THEN
        RAISE EXCEPTION 'Cannot unbind job (%) from project (%) — active payments exist for this job+project combination. Remove or reassign the payments first.',
          OLD.job_uuid, OLD.project_uuid;
      END IF;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;
  `);
  console.log('Created function prevent_job_project_unbind_with_payments');

  await p.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS trg_prevent_job_project_unbind_with_payments ON job_projects;
  `);

  await p.$executeRawUnsafe(`
    CREATE TRIGGER trg_prevent_job_project_unbind_with_payments
    BEFORE DELETE ON job_projects
    FOR EACH ROW
    EXECUTE FUNCTION prevent_job_project_unbind_with_payments();
  `);
  console.log('Created trigger trg_prevent_job_project_unbind_with_payments on job_projects');

  // Verify
  const triggers = await p.$queryRawUnsafe(`
    SELECT trigger_name, event_object_table, event_manipulation
    FROM information_schema.triggers
    WHERE trigger_name LIKE 'trg_prevent_job%'
    ORDER BY trigger_name
  `);
  console.log('\nActive triggers:');
  for (const t of triggers) {
    console.log(`  ${t.trigger_name} ON ${t.event_object_table} (${t.event_manipulation})`);
  }

  await p.$disconnect();
}
main();
