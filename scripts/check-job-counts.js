const { PrismaClient } = require('@prisma/client');
BigInt.prototype.toJSON = function () { return Number(this); };
const p = new PrismaClient();

(async () => {
  const total = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM jobs');
  const active = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM jobs WHERE is_active = true');
  const inactive = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM jobs WHERE is_active = false');
  const jp = await p.$queryRawUnsafe('SELECT COUNT(*)::int as cnt FROM job_projects');
  console.log('Total jobs:', total[0].cnt);
  console.log('Active jobs:', active[0].cnt);
  console.log('Inactive (deduped):', inactive[0].cnt);
  console.log('job_projects entries:', jp[0].cnt);
  await p.$disconnect();
})().catch(e => console.error(e));
