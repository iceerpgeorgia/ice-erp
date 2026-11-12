const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const project = await prisma.projects.findFirst({
    where: { project_name: 'Bagrationi Avenue' }
  });
  const jobs = await prisma.jobs.findMany({
    where: {
      job_projects: {
        some: { project_uuid: project.project_uuid }
      }
    },
    select: { job_uuid: true, job_name: true, selling_price: true },
    orderBy: { job_name: 'asc' }
  });
  console.log(`Total jobs for Bagrationi Avenue: ${jobs.length}`);
  jobs.forEach(j => {
    console.log(`  ${j.job_name}: ${j.selling_price}`);
  });
  await prisma.$disconnect();
})();
