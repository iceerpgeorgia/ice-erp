const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const factoryMapping = {
  "L0001": "B7NZ9753",
  "L0002": "B7NZ9754",
  "L0003": "B7NZ9755",
  "L0004": "B7NZ9756",
  "L0005": "B7NZ9757",
  "L0006": "B7NZ9758",
  "L0007": "B7NZ9759",
  "L0008": "B7NZ9760",
  "L0009": "B7NZ9761"
};

(async () => {
  try {
    // Find Alliance Highline project
    const project = await prisma.projects.findFirst({
      where: { project_name: { contains: "Alliance Highline", mode: "insensitive" } },
      select: { project_uuid: true }
    });

    if (!project) {
      console.error("Alliance Highline project not found");
      process.exit(1);
    }

    console.log("Found Alliance Highline project:", project.project_uuid, "\n");

    // Get the job_uuids bound to this project
    const boundJobs = await prisma.job_projects.findMany({
      where: { project_uuid: project.project_uuid },
      select: { job_uuid: true }
    });

    const boundJobUuids = new Set(boundJobs.map(bj => bj.job_uuid));
    console.log("Jobs bound to Alliance Highline:", boundJobUuids.size);

    // Get details of those specific jobs
    const projectJobs = await prisma.jobs.findMany({
      where: { job_uuid: { in: Array.from(boundJobUuids) } },
      select: { job_uuid: true, job_name: true, factory_no: true }
    });

    console.log("\nJobs in Alliance Highline project:");
    projectJobs.forEach(j => console.log(`  ${j.job_name} (${j.job_uuid.substring(0, 8)}...): ${j.factory_no}`));

    // Now update ONLY these project-specific jobs
    console.log("\nUpdating factory numbers...");
    let updated = 0;
    for (const job of projectJobs) {
      const newFactoryNo = factoryMapping[job.job_name];
      if (newFactoryNo && job.factory_no !== newFactoryNo) {
        await prisma.jobs.update({
          where: { job_uuid: job.job_uuid },
          data: { factory_no: newFactoryNo }
        });
        console.log(`  ✓ ${job.job_name} → ${newFactoryNo}`);
        updated++;
      }
    }

    console.log(`\n✅ Updated ${updated} jobs`);
    await prisma.$disconnect();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
