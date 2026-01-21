// Verify current employee status in Supabase
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyEmployeeStatus() {
  console.log('\n========================================');
  console.log('  EMPLOYEE STATUS VERIFICATION');
  console.log('========================================\n');

  try {
    // Get counts
    const totalCounteragents = await prisma.counteragents.count();
    const currentEmployees = await prisma.counteragents.count({
      where: { is_emploee: true }
    });
    const formerEmployees = await prisma.counteragents.count({
      where: { was_emploee: true }
    });
    const bothFlags = await prisma.counteragents.count({
      where: { 
        is_emploee: true,
        was_emploee: true 
      }
    });
    const onlyFormer = await prisma.counteragents.count({
      where: { 
        was_emploee: true,
        is_emploee: false
      }
    });
    const onlyCurrent = await prisma.counteragents.count({
      where: { 
        is_emploee: true,
        was_emploee: false
      }
    });

    console.log('SUPABASE DATABASE STATISTICS:');
    console.log('========================================\n');
    console.log(`Total counteragents: ${totalCounteragents}`);
    console.log(`\nCurrent employees (is_emploee=true): ${currentEmployees}`);
    console.log(`Former employees (was_emploee=true): ${formerEmployees}`);
    console.log(`\nBoth flags true: ${bothFlags}`);
    console.log(`Only current (is_emploee=true, was_emploee=false): ${onlyCurrent}`);
    console.log(`Only former (was_emploee=true, is_emploee=false): ${onlyFormer}\n`);

    console.log('========================================');
    console.log('           BREAKDOWN');
    console.log('========================================\n');
    console.log(`✓ Current employees only: ${onlyCurrent}`);
    console.log(`✓ Former employees only: ${onlyFormer}`);
    console.log(`✓ Both current & former: ${bothFlags}`);
    console.log(`✓ Total with employee status: ${currentEmployees + formerEmployees - bothFlags}\n`);

    console.log('========================================');
    console.log('  ✓ DATA STORED IN SUPABASE CLOUD ✓');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyEmployeeStatus();
