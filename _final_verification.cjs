const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("=== FINAL VERIFICATION OF ALL 4 COUNTERAGENTS ===\n");

    const data = [
      { name: "ისმაილ მამედოვი", id: "36650001820", iban: "GE74BG0000000603361594" },
      { name: "გიორგი პაპიაშვილი", id: "400114648", iban: "GE37BG0000000805250300" },
      { name: "ირაკლი კახოიძე", id: "01020003649", iban: "GE89BG0000000498676887" },
      { name: "ირაკლი გაბინაშვილი", id: "59001120426", iban: "GE79BG0000000371053391" },
    ];

    let allValid = true;
    for (const item of data) {
      const ca = await prisma.counteragents.findFirst({
        where: { identification_number: item.id },
      });

      const exists = !!ca;
      let status = "✗ NOT FOUND";
      let details = "";

      if (ca) {
        const isValid =
          ca.name === item.name &&
          ca.identification_number === item.id &&
          ca.iban === item.iban &&
          ca.sex === "m" &&
          ca.pension_scheme === true &&
          ca.entity_type === "ფიზ. პირი";

        if (isValid) {
          status = "✓ COMPLETE";
        } else {
          status = "⚠ INCOMPLETE";
          allValid = false;
          details = `Name: ${ca.name === item.name ? "✓" : "✗"}, ID: ${ca.identification_number === item.id ? "✓" : "✗"}, IBAN: ${ca.iban === item.iban ? "✓" : "✗"}, Sex (m): ${ca.sex === "m" ? "✓" : "✗"}, Pension: ${ca.pension_scheme === true ? "✓" : "✗"}, Type: ${ca.entity_type === "ფიზ. პირი" ? "✓" : "✗"}`;
        }
      } else {
        allValid = false;
      }

      console.log(`${item.name}`);
      console.log(`  ID: ${item.id}`);
      console.log(`  IBAN: ${item.iban}`);
      console.log(`  Status: ${status}`);
      if (details) console.log(`  Details: ${details}`);
      console.log("");
    }

    console.log("=".repeat(50));
    if (allValid) {
      console.log("✓ ALL 4 COUNTERAGENTS REGISTERED SUCCESSFULLY!");
    } else {
      console.log("⚠ Some records may be incomplete");
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
