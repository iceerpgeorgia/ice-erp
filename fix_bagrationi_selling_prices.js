const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const pricesMap = {
    'PL1': 105980,
    'PL2': 105980,
    'PL3': 105980,
    'PL4': 118950,
    'PL5': 118950,
    'PL6': 118950,
    'PL7': 118950,
    'PL8': 118950,
    'PL9': 105720,
    'PL10': 105720,
    'PL11': 105720,
    'SL1': 125795,
    'SL2': 125795,
    'SL3': 125795,
    'SL4': 125795,
    'PL12': 27749,
    'PL13': 27749,
    'PL14': 27749,
    'PL15': 27749,
    'SL5': 28919,
    'SL6': 28919,
    'SL7': 28918,
    'SL8': 28918,
  };

  try {
    console.log('🔍 Finding project: Bagrationi Avenue...');
    const project = await prisma.projects.findFirst({
      where: {
        project_name: 'Bagrationi Avenue',
      },
    });

    if (!project) {
      console.log('❌ Project not found');
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.project_name}`);
    console.log(`   UUID: ${project.project_uuid}`);
    console.log(`   Value: ${project.value} ${project.currency}`);
    console.log(`   Date: ${project.date}`);

    // Get all jobs for this project
    console.log('\n🔍 Fetching jobs for this project...');
    const jobs = await prisma.$queryRaw`
      SELECT j.job_uuid, j.job_name, j.selling_price, j.id
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      WHERE jp.project_uuid = ${project.project_uuid}::uuid
        AND j.is_active = true
      ORDER BY j.job_name ASC
    `;

    console.log(`✅ Found ${jobs.length} jobs`);
    console.log('\n📋 Current prices:');
    jobs.forEach(job => {
      console.log(`   ${job.job_name}: ${job.selling_price ?? 'NULL'}`);
    });

    // Update prices
    console.log('\n💾 Updating selling prices...');
    let updated = 0;
    for (const job of jobs) {
      const newPrice = pricesMap[job.job_name];
      if (newPrice !== undefined) {
        await prisma.jobs.update({
          where: { id: job.id },
          data: { selling_price: newPrice },
        });
        console.log(`   ✅ ${job.job_name}: ${job.selling_price ?? 'NULL'} → ${newPrice}`);
        updated++;
      } else {
        console.log(`   ⚠️  ${job.job_name}: No price mapping found`);
      }
    }

    console.log(`\n✅ Updated ${updated}/${jobs.length} jobs`);

    // Verify
    console.log('\n🔍 Verifying updates...');
    const updated_jobs = await prisma.$queryRaw`
      SELECT j.job_uuid, j.job_name, j.selling_price
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      WHERE jp.project_uuid = ${project.project_uuid}::uuid
        AND j.is_active = true
      ORDER BY j.job_name ASC
    `;

    console.log('\n📋 Updated prices:');
    let total = 0;
    updated_jobs.forEach(job => {
      console.log(`   ${job.job_name}: ${job.selling_price}`);
      total += Number(job.selling_price || 0);
    });

    console.log(`\n📊 Total selling price: ${total.toFixed(2)}`);
    console.log(`📊 Project value: ${project.value}`);
    
    if (Math.abs(total - project.value) < 0.01) {
      console.log('✅ Total matches project value!');
    } else {
      console.log(`⚠️  Difference: ${(total - project.value).toFixed(2)}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
