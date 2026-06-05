const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Get project UUID - looking for "Roomix" or similar
  const projects = await prisma.projects.findMany({
    select: {
      project_uuid: true,
      project_name: true,
    },
  });

  console.log('Available projects:');
  projects.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.project_name} (${p.project_uuid})`);
  });

  // Find the Roomix project (or whatever project the user is working with)
  const roomixProject = projects.find(p => p.project_name.includes('Roomix'));
  
  if (!roomixProject) {
    console.log('\nNo Roomix project found. Please specify project UUID manually.');
    process.exit(0);
  }

  console.log(`\n🎯 Deleting distributions for: ${roomixProject.project_name}`);
  console.log(`   Project UUID: ${roomixProject.project_uuid}`);

  const distributions = await prisma.payments_jobs.findMany({
    where: {
      project_uuid: roomixProject.project_uuid,
    },
    select: {
      uuid: true,
      payment_uuid: true,
      job_uuid: true,
      batch_partition_uuid: true,
      raw_record_uuid: true,
      amount: true,
    },
  });

  console.log(`\n📊 Found ${distributions.length} distributions to delete:`);
  distributions.forEach((d, idx) => {
    console.log(`   ${idx + 1}. Payment: ${d.payment_uuid}, Batch: ${d.batch_partition_uuid || 'NULL'}, Raw: ${d.raw_record_uuid || 'NULL'}, Amount: ${d.amount}`);
  });

  if (distributions.length === 0) {
    console.log('\n✅ No distributions to delete.');
    process.exit(0);
  }

  console.log(`\n⚠️  Deleting ${distributions.length} distributions...`);

  const result = await prisma.payments_jobs.deleteMany({
    where: {
      project_uuid: roomixProject.project_uuid,
    },
  });

  console.log(`\n✅ Deleted ${result.count} distribution records.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
