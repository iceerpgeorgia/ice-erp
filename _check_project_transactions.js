const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const projectUuid = 'abe14ec6-0eeb-4c77-beeb-fd0186a562f1';
  
  // Check if project exists
  const project = await prisma.projects.findUnique({
    where: { project_uuid: projectUuid },
    select: { project_uuid: true, project_index: true, project_name: true }
  });
  console.log('\n=== PROJECT ===');
  console.log(JSON.stringify(project, null, 2));
  
  // Check raw table for this project
  console.log('\n=== RAW TABLE COUNTS ===');
  const tables = [
    'GE78BG0000000893486000_BOG_GEL',
    'GE65TB7856036050100002_TBC_GEL',
    'GE74BG0000000586388146_BOG_USD',
    'GE78BG0000000893486000_BOG_USD',
  ];
  
  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM "${table}" WHERE project_uuid = $1::uuid`,
        projectUuid
      );
      console.log(`${table}: ${result[0].cnt}`);
    } catch (e) {
      console.log(`${table}: ERROR - ${e.message}`);
    }
  }
  
  // Check bank transactions with project_uuid info
  console.log('\n=== SAMPLE TRANSACTIONS ===');
  const samples = await prisma.$queryRawUnsafe(`
    SELECT uuid, project_uuid, payment_id, transaction_date 
    FROM "GE78BG0000000893486000_BOG_GEL" 
    WHERE project_uuid = $1::uuid 
    LIMIT 3
  `, projectUuid);
  console.log(JSON.stringify(samples, null, 2));
  
  // Check if project has jobs
  console.log('\n=== JOBS FOR PROJECT ===');
  const jobs = await prisma.job_projects.findMany({
    where: { project_uuid: projectUuid },
    select: { job_uuid: true },
  });
  console.log(`Total jobs: ${jobs.length}`);
  
  await prisma.$disconnect();
}

check().catch(console.error);
