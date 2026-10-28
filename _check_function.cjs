const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Checking update_counteragent_computed_columns() function:\n");

    const func = await prisma.$queryRaw`
      SELECT 
        proname as function_name,
        prosrc as source_code
      FROM pg_proc
      WHERE proname = 'update_counteragent_computed_columns'
    `;

    if (func.length > 0) {
      console.log(`Function: ${func[0].function_name}\n`);
      console.log("Source code:\n");
      console.log(func[0].source_code);
    } else {
      console.log("Function not found");
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error:", error.message);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  }
})();
