const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const names = [
  "ისმაილ მამედოვი",
  "გიორგი პაპიაშვილი",
  "ირაკლი კახოიძე",
  "ირაკლი გაბინაშვილი",
];

(async () => {
  try {
    console.log("Verifying registered counteragents:\n");

    for (const name of names) {
      const ca = await prisma.counteragents.findFirst({
        where: { name },
      });

      if (!ca) {
        console.log(`✗ ${name} - NOT FOUND`);
        continue;
      }

      const checks = {
        name: ca.name === name ? "✓" : "✗",
        sex: ca.sex === "m" ? "✓" : "✗",
        pension_scheme: ca.pension_scheme === true ? "✓" : "✗",
        entity_type: ca.entity_type === "ფიზ. პირი" ? "✓" : "✗",
      };

      console.log(`${name}`);
      console.log(`  UUID: ${ca.counteragent_uuid}`);
      console.log(`  IBAN: ${ca.iban}`);
      console.log(`  ID: ${ca.identification_number}`);
      console.log(`  Sex (m): ${checks.sex}`);
      console.log(`  Pension Scheme: ${checks.pension_scheme}`);
      console.log(`  Entity Type (ფიზ. პირი): ${checks.entity_type}`);
      console.log(`  Actual entity_type value: "${ca.entity_type}"`);
      console.log("");
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
