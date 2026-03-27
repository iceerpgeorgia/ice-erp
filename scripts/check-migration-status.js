const { PrismaClient } = require('@prisma/client');
BigInt.prototype.toJSON = function () { return Number(this); };
const p = new PrismaClient();

(async () => {
  const a = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM jobs WHERE is_active = true');
  const jp = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM job_projects');
  const nullable = await p.$queryRawUnsafe("SELECT is_nullable FROM information_schema.columns WHERE table_name='jobs' AND column_name='project_uuid'");
  console.log('Active jobs:', a[0].cnt);
  console.log('job_projects entries:', jp[0].cnt);
  console.log('project_uuid nullable:', nullable[0]?.is_nullable);
  await p.$disconnect();
})().catch(e => console.error(e));
