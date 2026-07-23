const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = '2496a0e0-1118-49dc-8a82-539003dc1b23';
  
  // Get the project
  const project = await prisma.projects.findUnique({
    where: { project_uuid: projectUuid }
  });
  console.log('Project:', { uuid: project.project_uuid, name: project.project_name, value: project.value, payment_id: project.payment_id });
  
  // Get adjustments for this project's payment_id
  if (project.payment_id) {
    const adjustments = await prisma.payment_adjustments.findMany({
      where: { 
        payment_id: project.payment_id,
        is_deleted: false 
      }
    });
    console.log('\nAdjustments for payment_id', project.payment_id, ':', adjustments);
  }
  
  // Get all adjustments (not deleted)
  const allAdj = await prisma.payment_adjustments.findMany({
    where: { is_deleted: false },
    take: 10
  });
  console.log('\nAll non-deleted adjustments (sample):', allAdj.length > 0 ? allAdj[0] : 'none');
  
  // Get payments with adjustments
  const paymentsWithAdj = await prisma.$queryRaw`
    SELECT DISTINCT pa.payment_id, p.is_active 
    FROM payment_adjustments pa
    LEFT JOIN payments p ON p.payment_id = pa.payment_id::text
    WHERE pa.is_deleted = false
    LIMIT 5
  `;
  console.log('\nPayments with adjustments:', paymentsWithAdj);
  
  await prisma.$disconnect();
}

check().catch(e => console.error(e));
