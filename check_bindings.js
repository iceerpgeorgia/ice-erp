const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    // Find Alliance Highline project
    const project = await prisma.projects.findFirst({
      where: { project_name: { contains: "Alliance Highline", mode: "insensitive" } },
      select: { project_uuid: true, project_name: true }
    });

    console.log("\n=== Project Info ===");
    console.log("Name:", project?.project_name);
    console.log("UUID:", project?.project_uuid);

    if (!project) {
      console.log("Project not found!");
      process.exit(1);
    }

    // Check job-project bindings for this project
    const bindings = await prisma.job_projects.findMany({
      where: { project_uuid: project.project_uuid },
      select: { job_uuid: true }
    });

    console.log("\n=== Job-Project Bindings ===");
    console.log("Total bindings:", bindings.length);
    bindings.slice(0, 5).forEach(b => console.log("  -", b.job_uuid));

    // Check jobs themselves
    const jobs = await prisma.jobs.findMany({
      where: { job_name: { in: ["L0001", "L0002", "L0003", "L0004", "L0005"] } },
      select: { job_uuid: true, job_name: true, factory_no: true, is_active: true }
    });

    console.log("\n=== Jobs with Factory No ===");
    jobs.forEach(j => console.log(`  ${j.job_name}: factory_no="${j.factory_no}"`));

    await prisma.$disconnect();
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
