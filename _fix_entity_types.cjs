const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const uuids = [
      "d4f2a98e-b76d-40ea-b9fd-6d6e193271a4", // ისმაილ მამედოვი
      "b2f6dbea-e159-4264-919a-1e5b22291f4b", // ირაკლი კახოიძე
      "7701e135-5bc3-4959-9abb-da47c36f680a", // ირაკლი გაბინაშვილი
    ];

    console.log("Updating entity_type to ფიზ. პირი for 3 records:\n");

    for (const uuid of uuids) {
      const updated = await prisma.counteragents.update({
        where: { counteragent_uuid: uuid },
        data: { entity_type: "ფიზ. პირი" },
      });

      console.log(`✓ Updated ${updated.name}`);
      console.log(`  UUID: ${updated.counteragent_uuid}`);
      console.log(`  Entity Type: ${updated.entity_type}\n`);
    }

    console.log("\nVerifying all 4 records:");

    const names = [
      "ისმაილ მამედოვი",
      "გიორგი პაპიაშვილი",
      "ირაკლი კახოიძე",
      "ირაკლი გაბინაშვილი",
    ];

    for (const name of names) {
      const ca = await prisma.counteragents.findFirst({
        where: { name },
      });

      if (!ca) {
        console.log(`\n${name}: ✗ NOT FOUND`);
        continue;
      }

      const allCorrect =
        ca.sex === "m" &&
        ca.pension_scheme === true &&
        ca.entity_type === "ფიზ. პირი";

      console.log(`\n${name}: ${allCorrect ? "✓ ALL CORRECT" : "✗ INCOMPLETE"}`);
      console.log(`  Sex: ${ca.sex} (expected: m)`);
      console.log(`  Pension: ${ca.pension_scheme} (expected: true)`);
      console.log(`  Entity Type: ${ca.entity_type} (expected: ფიზ. პირი)`);
      console.log(`  IBAN: ${ca.iban}`);
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
