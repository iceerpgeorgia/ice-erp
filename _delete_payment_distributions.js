const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Payment UUIDs from the console logs
  const paymentUuids = [
    '26d78cfb-1c8d-434d-ac39-c8c2140416a8', // payment_id: 51a575_51_bcfcf5
    '6e9008ea-140c-4bec-8aeb-78ba661fdc99', // payment_id: 39dbcb_5e_a9dccc
  ];

  console.log('🔍 Checking distributions for payment UUIDs...\n');

  for (const paymentUuid of paymentUuids) {
    const distributions = await prisma.payments_jobs.findMany({
      where: {
        payment_uuid: paymentUuid,
      },
      select: {
        uuid: true,
        payment_uuid: true,
        job_uuid: true,
        project_uuid: true,
        batch_partition_uuid: true,
        raw_record_uuid: true,
        amount: true,
      },
    });

    console.log(`Payment UUID: ${paymentUuid}`);
    console.log(`Found ${distributions.length} distributions:`);
    
    if (distributions.length > 0) {
      distributions.forEach((d, idx) => {
        console.log(`  ${idx + 1}. Batch: ${d.batch_partition_uuid || 'NULL'}, Raw: ${d.raw_record_uuid || 'NULL'}, Amount: ${d.amount}`);
      });
      console.log('');
    }
  }

  console.log('\n⚠️  Deleting ALL distributions for these payment UUIDs...\n');

  const result = await prisma.payments_jobs.deleteMany({
    where: {
      payment_uuid: {
        in: paymentUuids,
      },
    },
  });

  console.log(`✅ Deleted ${result.count} distribution records.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
