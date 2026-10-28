const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");
const prisma = new PrismaClient();

const counteragents = [
  {
    name: "ისმაილ მამედოვი",
    identification_number: "36650001820",
    iban: "GE74BG0000000603361594",
  },
  {
    name: "გიორგი პაპიაშვილი",
    identification_number: "400114648",
    iban: "GE37BG0000000805250300",
  },
  {
    name: "ირაკლი კახოიძე",
    identification_number: "01020003649",
    iban: "GE89BG0000000498676887",
  },
  {
    name: "ირაკლი გაბინაშვილი",
    identification_number: "59001120426",
    iban: "GE79BG0000000371053391",
  },
];

(async () => {
  try {
    const results = [];
    
    for (const ca of counteragents) {
      try {
        const result = await prisma.counteragents.create({
          data: {
            counteragent_uuid: uuidv4(),
            name: ca.name,
            entity_type: "ფიზ. პირი",
            identification_number: ca.identification_number,
            iban: ca.iban,
            sex: "m",
            pension_scheme: true,
          },
        });
        results.push({
          name: ca.name,
          uuid: result.counteragent_uuid,
          iban: result.iban,
          status: "✓ Created",
        });
        console.log(`✓ ${ca.name} registered (${result.counteragent_uuid})`);
      } catch (err) {
        if (err.message.includes("identification_number")) {
          console.log(`⚠ ${ca.name} already exists (ID: ${ca.identification_number})`);
          results.push({
            name: ca.name,
            uuid: "N/A",
            iban: ca.iban,
            status: "⚠ Already exists",
          });
        } else {
          throw err;
        }
      }
    }

    console.log("\nRegistration complete:");
    console.table(results);

    await prisma.$disconnect();
  } catch (error) {
    console.error("Error:", error.message);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(1);
  }
})();
