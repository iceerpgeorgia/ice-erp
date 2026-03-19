const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS job_projects (
      id BIGSERIAL PRIMARY KEY,
      job_uuid UUID NOT NULL,
      project_uuid UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_job_projects_job_project UNIQUE (job_uuid, project_uuid)
    )
  `);
  console.log('Table created');

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_job_projects_project_uuid ON job_projects (project_uuid)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_job_projects_job_uuid ON job_projects (job_uuid)');
  console.log('Indexes created');

  const backfilled = await prisma.$executeRawUnsafe(`
    INSERT INTO job_projects (job_uuid, project_uuid)
    SELECT j.job_uuid, j.project_uuid FROM jobs j
    WHERE j.is_active = true AND j.project_uuid IS NOT NULL
    ON CONFLICT (job_uuid, project_uuid) DO NOTHING
  `);
  console.log('Backfilled:', backfilled, 'rows');

  const count = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM job_projects');
  console.log('Total job_projects:', count);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
