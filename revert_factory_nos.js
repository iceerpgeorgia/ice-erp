const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const factoryNos = ["B7NZ9753", "B7NZ9754", "B7NZ9755", "B7NZ9756", "B7NZ9757", "B7NZ9758", "B7NZ9759", "B7NZ9760", "B7NZ9761"];

(async () => {
  try {
    console.log("=== REVERTING CHANGES ===\n");

    // Get Alliance Highline project
    const allianceProject = await prisma.projects.findFirst({
      where: { project_name: { contains: "Alliance Highline", mode: "insensitive" } },
      select: { project_uuid: true }
    });

    // Get Alliance Highline job UUIDs
    const allianceBindings = await prisma.job_projects.findMany({
      where: { project_uuid: allianceProject.project_uuid },
      select: { job_uuid: true }
    });
    const allianceJobUuids = new Set(allianceBindings.map(b => b.job_uuid));

    console.log("Alliance Highline has", allianceJobUuids.size, "jobs\n");

    // Find all jobs with these factory numbers that DON'T belong to Alliance Highline
    const jobsWithTheseFactoryNos = await prisma.jobs.findMany({
      where: { factory_no: { in: factoryNos } },
      select: { 
        job_uuid: true, 
        job_name: true, 
        factory_no: true,
        is_active: true
      }
    });

    console.log(`Found ${jobsWithTheseFactoryNos.length} jobs with B7NZ factory numbers\n`);

    // Identify which ones need to be reverted
    const jobsToRevert = jobsWithTheseFactoryNos.filter(j => !allianceJobUuids.has(j.job_uuid));

    console.log(`Jobs to REVERT (not in Alliance Highline): ${jobsToRevert.length}\n`);
    jobsToRevert.forEach(j => {
      console.log(`  - ${j.job_name} (${j.job_uuid.substring(0, 8)}...): ${j.factory_no} → NULL`);
    });

    if (jobsToRevert.length > 0) {
      console.log("\nReverting...");
      for (const job of jobsToRevert) {
        await prisma.jobs.update({
          where: { job_uuid: job.job_uuid },
          data: { factory_no: null }
        });
      }
      console.log(`✓ Reverted ${jobsToRevert.length} jobs\n`);
    }

    // Show Alliance Highline jobs status
    console.log("=== Alliance Highline Jobs Status ===\n");
    const allianceJobs = await prisma.jobs.findMany({
      where: { job_uuid: { in: Array.from(allianceJobUuids) } },
      select: { job_uuid: true, job_name: true, factory_no: true }
    });

    allianceJobs.forEach(j => {
      console.log(`  ${j.job_name}: ${j.factory_no || "NULL"}`);
    });

    await prisma.$disconnect();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
