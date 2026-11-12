const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const project = await prisma.projects.findFirst({
      where: {
        project_name: { contains: "Alliance", mode: "insensitive" }
      }
    });
    
    if (project) {
      console.log("PROJECT FOUND:");
      const projectData = JSON.parse(JSON.stringify(project, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      ));
      console.log(JSON.stringify(projectData, null, 2));
      
      const jobs = await prisma.jobs.findMany({
        where: {
          project_uuid: project.project_uuid
        },
        orderBy: { job_name: "asc" }
      });
      
      console.log("\nJOBS FOR PROJECT:");
      console.log("Total jobs:", jobs.length);
      let totalPrice = 0;
      jobs.forEach(j => {
        totalPrice += j.selling_price || 0;
        console.log("  " + j.job_name + " (Factory: " + j.factory_no + "): $" + (j.selling_price || "NULL"));
      });
      console.log("TOTAL SELLING PRICE:", totalPrice);
    } else {
      console.log("Project not found");
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
