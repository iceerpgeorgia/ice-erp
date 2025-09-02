// Simple seed for E2E runs
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // Seed minimal country if model exists
    if (prisma.country) {
      await prisma.country.upsert({
        where: { iso3: 'USA' },
        create: {
          id: 1,
          iso2: 'US',
          iso3: 'USA',
          name_en: 'United States',
          name_ka: 'აშშ',
        },
        update: {},
      });
    }
  } catch (e) {
    // non-fatal: schema may differ; continue
    console.warn('Seed skipped or partial:', e?.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

