const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const project = await prisma.projects.findFirst({
      where: { project_name: { contains: "Alliance", mode: "insensitive" } }
    });
    
    if (!project) return console.log("Project not found");
    
    const projectUuid = project.project_uuid.toString();
    
    // Get all jobs with detailed info using queryRaw with Prisma.sql
    const jobs = await prisma.$queryRaw(Prisma.sql`
      SELECT 
        j.job_uuid, j.job_name, j.selling_price, j.factory_no,
        COALESCE(SUM(pj.amount_account_curr), 0) as total_paid_gel,
        COUNT(*) FILTER (WHERE pj.uuid IS NOT NULL) as distribution_count
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      LEFT JOIN payments_jobs pj ON pj.job_uuid = j.job_uuid
      WHERE jp.project_uuid::text = ${projectUuid}
      GROUP BY j.job_uuid, j.job_name, j.selling_price, j.factory_no
      ORDER BY j.job_name ASC
    `);
    
    console.log("ALLIANCE HIGHLINE - JOBS & PAYMENT ALLOCATIONS");
    console.log("=".repeat(120));
    console.log(`Project: ${project.project_name} | Value: $${project.value} USD`);
    console.log("");
    
    let totalSelling = 0;
    let totalPaid = 0;
    
    jobs.forEach(j => {
      const paidGel = parseFloat(j.total_paid_gel) || 0;
      const selling = parseFloat(j.selling_price) || 0;
      totalSelling += selling;
      totalPaid += paidGel;
      console.log(`${j.job_name.padEnd(30)} | Factory: ${String(j.factory_no || "").padEnd(8)} | Selling: $${String(selling).padEnd(12)} | Paid GEL: ${String(paidGel).padEnd(12)} | Distributions: ${j.distribution_count}`);
    });
    
    console.log("=".repeat(120));
    console.log(`TOTALS: Selling Price: $${totalSelling} | Total Paid GEL: ${totalPaid}`);
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
