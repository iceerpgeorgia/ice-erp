const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Checking for გიორგი პაპიაშვილი with ID 400114648:\n");

    // Check by identification number
    const byId = await prisma.counteragents.findFirst({
      where: { identification_number: "400114648" },
    });

    if (byId) {
      console.log("Found by ID:");
      console.log(`  Name: ${byId.name}`);
      console.log(`  UUID: ${byId.counteragent_uuid}`);
      console.log(`  Entity Type: ${byId.entity_type}`);
      console.log(`  Sex: ${byId.sex}`);
      console.log(`  Pension: ${byId.pension_scheme}`);
    } else {
      console.log("Not found by ID");
    }

    // Check entity_type values in database
    console.log("\n\nAll entity_type values currently in database:");
    const types = await prisma.counteragents.findMany({
      distinct: ["entity_type"],
      select: { entity_type: true },
    });
    
    console.log(JSON.stringify(types, null, 2));

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error:", error.message);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  }
})();
