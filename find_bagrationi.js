const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const projects = await prisma.projects.findMany({
    where: {
      project_name: { contains: "Bagrationi", mode: "insensitive" }
    },
    select: {
      project_uuid: true,
      project_name: true,
      project_index: true,
      value: true,
      currency: true,
      date: true
    }
  });
  console.log("All Bagrationi projects:");
  projects.forEach(p => {
    console.log("  " + p.project_name + " | Value: " + p.value + " " + p.currency + " | Date: " + p.date);
  });
  await prisma.$disconnect();
})();
