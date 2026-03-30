const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

const uuids = [
  'e3cc81a7-7d5e-4872-b0d8-05056251e293', // L0001
  'f80d9072-4fc3-46a8-9f27-90da8c84b4ae', // L0003
  'b2a9bd9f-b174-4a02-b6b6-a5fd636d393d', // L0002
];

(async () => {
  for (const uuid of uuids) {
    const [job] = await p.$queryRawUnsafe(
      `SELECT job_uuid, job_name, is_active FROM jobs WHERE job_uuid = $1::uuid`, uuid
    );
    const bindings = await p.$queryRawUnsafe(
      `SELECT jp.project_uuid, pr.project_name FROM job_projects jp JOIN projects pr ON jp.project_uuid = pr.project_uuid WHERE jp.job_uuid = $1::uuid`, uuid
    );
    const [pays] = await p.$queryRawUnsafe(
      `SELECT count(*) as cnt FROM payments WHERE job_uuid = $1::uuid`, uuid
    );
    console.log(`${job.job_name} (${uuid}): is_active=${job.is_active}, bindings=${bindings.length} [${bindings.map(b=>b.project_name).join(', ')}], payments=${Number(pays.cnt)}`);
  }
  await p.$disconnect();
})();
