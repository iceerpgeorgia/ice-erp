const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const result = await prisma.$queryRaw`
      SELECT j.job_uuid, j.job_name, j.selling_price
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      INNER JOIN projects p ON p.project_uuid = jp.project_uuid
      WHERE p.project_name = 'Bagrationi Avenue'
      ORDER BY j.job_name ASC
    `;
    console.log('Total jobs:', result.length);
    let total = 0;
    result.forEach(r => {
      const price = Number(r.selling_price) || 0;
      total += price;
      console.log(`  ${r.job_name}: ${price}`);
    });
    console.log('Total:', total);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
