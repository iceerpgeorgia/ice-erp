const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Testing entity_type update with raw SQL:\n");

    // Test update with raw SQL using ARRAY
    const result = await prisma.$queryRaw`
      UPDATE counteragents 
      SET entity_type = 'ფიზ. პირი'
      WHERE counteragent_uuid = ANY(ARRAY['d4f2a98e-b76d-40ea-b9fd-6d6e193271a4'::uuid, 'b2f6dbea-e159-4264-919a-1e5b22291f4b'::uuid, '7701e135-5bc3-4959-9abb-da47c36f680a'::uuid])
      RETURNING counteragent_uuid, name, entity_type
    `;

    console.log(`Updated ${result.length} rows:\n`);
    for (const row of result) {
      console.log(`${row.name}`);
      console.log(`  Entity Type: ${row.entity_type}\n`);
    }

    // Verify with SELECT
    console.log("\nVerifying with SELECT:");
    const verify = await prisma.$queryRaw`
      SELECT name, sex, pension_scheme, entity_type, iban
      FROM counteragents
      WHERE name IN ('ისმაილ მამედოვი', 'ირაკლი კახოიძე', 'ირაკლი გაბინაშვილი')
      ORDER BY name
    `;

    for (const row of verify) {
      const allCorrect =
        row.sex === "m" &&
        row.pension_scheme === true &&
        row.entity_type === "ფიზ. პირი";

      console.log(`${row.name}: ${allCorrect ? "✓" : "✗"}`);
      console.log(`  Sex: ${row.sex}, Pension: ${row.pension_scheme}, Type: ${row.entity_type}\n`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error:", error.message);
    console.error(error);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  }
})();
