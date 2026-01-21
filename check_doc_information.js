const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const samples = await prisma.$queryRawUnsafe(`
    SELECT doc_information
    FROM bog_gel_raw_893486000
    WHERE doc_information IS NOT NULL
    LIMIT 20
  `);

  console.log('\n📋 Sample DocInformation Fields:');
  samples.forEach((row, i) => {
    const info = row.doc_information || '';
    // Check if it contains salary pattern
    if (info.match(/NP_/i)) {
      console.log(`\n${i + 1}. [SALARY] ${info}`);
    } else {
      console.log(`\n${i + 1}. ${info.substring(0, 100)}${info.length > 100 ? '...' : ''}`);
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
