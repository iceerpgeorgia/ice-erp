const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const l0001 = 'b3ace415-638a-4c17-915d-0bfc68b0836f';
  const dekaLisi = '317f801f-bf5e-43fc-91d4-d5978e6673a3';
  const kvareli = '97467425-3024-4e47-a9e4-7fae80ccd880';

  // Add Kvareli Elevators binding back
  await p.$queryRawUnsafe(
    'INSERT INTO job_projects (job_uuid, project_uuid) VALUES ($1::uuid, $2::uuid) ON CONFLICT DO NOTHING',
    l0001, kvareli
  );
  console.log('Added Kvareli Elevators binding');

  // Remove Deka Lisi binding
  await p.$queryRawUnsafe(
    'DELETE FROM job_projects WHERE job_uuid = $1::uuid AND project_uuid = $2::uuid',
    l0001, dekaLisi
  );
  console.log('Removed Deka Lisi binding');

  // Verify
  const bindings = await p.$queryRawUnsafe(
    'SELECT jp.project_uuid, pr.project_name FROM job_projects jp JOIN projects pr ON jp.project_uuid = pr.project_uuid WHERE jp.job_uuid = $1::uuid',
    l0001
  );
  console.log('L0001 now bound to:', bindings);

  await p.$disconnect();
})();
