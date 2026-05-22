const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.$queryRawUnsafe("SELECT project_uuid::text AS uuid, project_name FROM projects WHERE project_name ILIKE '%LUX%' LIMIT 3");
  console.log('LUX projects:', rows);
  const proj = rows[0];
  if (!proj) { await prisma.$disconnect(); return; }
  const url = "https://ice-erp.vercel.app/api/projects-report?projectUuids=" + proj.uuid + "&targetCurrency=USD";
  console.log('Fetching', url);
  const res = await fetch(url);
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text.slice(0, 2000));
  await prisma.$disconnect();
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
