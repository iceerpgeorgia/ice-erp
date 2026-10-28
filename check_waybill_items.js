const { PrismaClient } = require('@prisma/client');

async function checkWaybillItems() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.rs_waybills_in_items.count();
    console.log('Total rs_waybills_in_items records:', count);
    
    if (count > 0) {
      const sample = await prisma.rs_waybills_in_items.findFirst({
        select: {
          id: true,
          waybill_no: true,
          goods_name: true,
          project_uuid: true,
          financial_code_uuid: true,
          corresponding_account: true,
        }
      });
      console.log('\nSample record:');
      console.log(sample);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkWaybillItems();
