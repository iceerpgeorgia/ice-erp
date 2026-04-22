const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBundleGet() {
  const projectUuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f';
  
  // Get the project's bundle FC and value
  const projects = await prisma.$queryRawUnsafe(
    `SELECT financial_code_uuid::text, value::numeric FROM projects WHERE project_uuid = $1::uuid LIMIT 1`,
    projectUuid
  );
  
  console.log('Project FC:', projects[0]);
  
  // Get child FCs with their existing payment info and ledger aggregates
  const rows = await prisma.$queryRawUnsafe(
    `SELECT
       fc.uuid::text AS financial_code_uuid,
       fc.name AS financial_code_name,
       fc.code AS financial_code_code,
       p.payment_id,
       (SELECT COALESCE(SUM("order"), 0) 
        FROM payments_ledger 
        WHERE payment_id = p.payment_id) AS total_order,
       (SELECT MAX(effective_date) 
        FROM payments_ledger 
        WHERE payment_id = p.payment_id) AS latest_date
     FROM financial_codes fc
     LEFT JOIN payments p
       ON p.project_uuid = $1::uuid
       AND p.financial_code_uuid = fc.uuid
       AND p.is_bundle_payment = true
     WHERE fc.parent_uuid = $2::uuid AND fc.is_active = true
     ORDER BY fc.sort_order, fc.code`,
    projectUuid,
    projects[0].financial_code_uuid
  );
  
  console.log('\nQuery results:');
  rows.forEach(row => {
    console.log({
      code: row.financial_code_code,
      name: row.financial_code_name,
      payment_id: row.payment_id,
      total_order: row.total_order,
      latest_date: row.latest_date
    });
  });
  
  console.log('\nFormatted distribution:');
  const distribution = rows.map(row => {
    let distributionDate = '';
    if (row.latest_date) {
      const d = new Date(row.latest_date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      distributionDate = `${day}.${month}.${year}`;
    }
    
    return {
      financialCodeUuid: row.financial_code_uuid,
      financialCodeName: `${row.financial_code_code} - ${row.financial_code_name}`,
      percentage: '',
      amount: row.total_order ? String(row.total_order) : '',
      paymentId: row.payment_id || null,
      distributionDate: distributionDate,
    };
  });
  
  console.log(JSON.stringify(distribution, null, 2));
  
  await prisma.$disconnect();
}

testBundleGet().catch(console.error);
