const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Finding entity_type_uuid for ფიზ. პირი:\n");

    const entityType = await prisma.$queryRaw`
      SELECT entity_type_uuid, name_ka
      FROM entity_types
      WHERE name_ka = 'ფიზ. პირი'
      LIMIT 1
    `;

    if (entityType.length === 0) {
      console.log("Entity type ფიზ. პირი NOT FOUND");
      console.log("\nAvailable entity types:");
      const types = await prisma.$queryRaw`
        SELECT entity_type_uuid, name_ka
        FROM entity_types
        ORDER BY name_ka
      `;
      for (const t of types) {
        console.log(`  ${t.name_ka}: ${t.entity_type_uuid}`);
      }
      await prisma.$disconnect();
      return;
    }

    const uuid = entityType[0].entity_type_uuid;
    console.log(`Found: ფიზ. პირი = ${uuid}\n`);

    // Update the 3 records with this entity_type_uuid
    console.log("Updating 3 counteragent records with entity_type_uuid...\n");

    const result = await prisma.$queryRaw`
      UPDATE counteragents
      SET entity_type_uuid = ${uuid}::uuid
      WHERE counteragent_uuid = ANY(ARRAY[
        '7701e135-5bc3-4959-9abb-da47c36f680a'::uuid,
        'b2f6dbea-e159-4264-919a-1e5b22291f4b'::uuid,
        'd4f2a98e-b76d-40ea-b9fd-6d6e193271a4'::uuid
      ])
      RETURNING name, entity_type, entity_type_uuid
    `;

    console.log(`Updated ${result.length} records:\n`);
    for (const row of result) {
      console.log(`${row.name}`);
      console.log(`  Entity Type: ${row.entity_type}`);
      console.log(`  Entity Type UUID: ${row.entity_type_uuid}\n`);
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
