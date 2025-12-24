const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJobsBrands() {
  try {
    // Check jobs with brand_uuid
    const jobsWithBrands = await prisma.$queryRaw`
      SELECT 
        j.id,
        j.job_name,
        j.brand_uuid,
        b.uuid as brand_uuid_in_brands,
        b.name as brand_name
      FROM jobs j
      LEFT JOIN brands b ON j.brand_uuid = b.uuid
      LIMIT 10
    `;
    
    console.log('\n=== Jobs with Brand UUIDs ===');
    jobsWithBrands.forEach(job => {
      console.log({
        id: Number(job.id),
        job_name: job.job_name,
        brand_uuid: job.brand_uuid,
        brand_name: job.brand_name
      });
    });
    
    // Check all brands
    const brands = await prisma.$queryRaw`
      SELECT uuid, name FROM brands LIMIT 10
    `;
    
    console.log('\n=== Available Brands ===');
    brands.forEach(b => {
      console.log({ uuid: b.uuid, name: b.name });
    });
    
    // Count jobs without brands
    const jobsWithoutBrands = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM jobs WHERE brand_uuid IS NULL
    `;
    
    console.log('\n=== Jobs without brand_uuid ===');
    jobsWithoutBrands.forEach(row => {
      console.log({ count: Number(row.count) });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkJobsBrands();
