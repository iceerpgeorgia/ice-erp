const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Updating record with ID 400114648 to correct properties:\n");

    // Find the entity_type_uuid for ფიზ. პირი
    const entityType = await prisma.$queryRaw`
      SELECT entity_type_uuid FROM entity_types WHERE name_ka = 'ფიზ. პირი' LIMIT 1
    `;

    const typeUuid = entityType[0].entity_type_uuid;

    // Update the record
    const updated = await prisma.counteragents.update({
      where: { identification_number: "400114648" },
      data: {
        name: "გიორგი პაპიაშვილი",
        sex: "m",
        pension_scheme: true,
        entity_type_uuid: typeUuid,
      },
    });

    console.log(`Updated counteragent:`);
    console.log(`  Name: ${updated.name}`);
    console.log(`  ID: ${updated.identification_number}`);
    console.log(`  IBAN: ${updated.iban}`);
    console.log(`  Sex: ${updated.sex}`);
    console.log(`  Pension Scheme: ${updated.pension_scheme}`);
    console.log(`  Entity Type UUID: ${updated.entity_type_uuid}`);

    // Verify by querying directly
    const verify = await prisma.$queryRaw`
      SELECT name, identification_number, iban, sex, pension_scheme, entity_type
      FROM counteragents
      WHERE identification_number = '400114648'
    `;

    if (verify.length > 0) {
      const v = verify[0];
      console.log(`\nVerified (after trigger):`);
      console.log(`  Name: ${v.name}`);
      console.log(`  Entity Type: ${v.entity_type}`);
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
