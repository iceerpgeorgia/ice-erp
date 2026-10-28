const { PrismaClient } = require('@prisma/client');

async function checkWaybillItemsStats() {
  const prisma = new PrismaClient();
  try {
    const total = await prisma.rs_waybills_in_items.count();
    
    // Count records where at least one of the three fields is filled (check = true)
    const checkPassed = await prisma.rs_waybills_in_items.count({
      where: {
        OR: [
          { project_uuid: { not: null } },
          { financial_code_uuid: { not: null } },
          { corresponding_account: { not: null } },
        ]
      }
    });
    
    // Count records where none of the three fields are filled (check = false)
    const checkFailed = await prisma.rs_waybills_in_items.count({
      where: {
        AND: [
          { project_uuid: null },
          { financial_code_uuid: null },
          { corresponding_account: null },
        ]
      }
    });
    
    console.log('Waybill Items Statistics:');
    console.log('========================');
    console.log('Total records:', total);
    console.log('Check = True (at least one field filled):', checkPassed, `(${((checkPassed/total)*100).toFixed(1)}%)`);
    console.log('Check = False (all fields empty):', checkFailed, `(${((checkFailed/total)*100).toFixed(1)}%)`);
    
    // Show breakdown by field
    const projectFilled = await prisma.rs_waybills_in_items.count({
      where: { project_uuid: { not: null } }
    });
    
    const fcFilled = await prisma.rs_waybills_in_items.count({
      where: { financial_code_uuid: { not: null } }
    });
    
    const caFilled = await prisma.rs_waybills_in_items.count({
      where: { corresponding_account: { not: null } }
    });
    
    console.log('\nField breakdown:');
    console.log('- Project filled:', projectFilled, `(${((projectFilled/total)*100).toFixed(1)}%)`);
    console.log('- Financial Code filled:', fcFilled, `(${((fcFilled/total)*100).toFixed(1)}%)`);
    console.log('- Corresponding Account filled:', caFilled, `(${((caFilled/total)*100).toFixed(1)}%)`);
    
  } finally {
    await prisma.$disconnect();
  }
}

checkWaybillItemsStats();
