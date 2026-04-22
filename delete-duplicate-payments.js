const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteDuplicates() {
  try {
    const duplicateIds = [7286, 7283, 7284, 7285];
    
    console.log('=== Deleting Duplicate Payments ===\n');
    console.log('IDs to delete:', duplicateIds.join(', '));
    
    // First, check if any have attachment_links (linked by record_uuid)
    const links = await prisma.$queryRawUnsafe(`
      SELECT owner_uuid 
      FROM attachment_links 
      WHERE owner_table = 'payments' 
        AND owner_uuid::text IN (
          SELECT record_uuid 
          FROM payments 
          WHERE id = ANY($1::bigint[])
        )
    `, duplicateIds);
    
    if (links.length > 0) {
      console.log(`⚠️  Found ${links.length} attachment links to delete first`);
      await prisma.$queryRawUnsafe(`
        DELETE FROM attachment_links 
        WHERE owner_table = 'payments' 
          AND owner_uuid::text IN (
            SELECT record_uuid 
            FROM payments 
            WHERE id = ANY($1::bigint[])
          )
      `, duplicateIds);
      console.log('✅ Deleted attachment links');
    }
    
    // Delete the duplicate payments
    const result = await prisma.$queryRawUnsafe(`
      DELETE FROM payments 
      WHERE id = ANY($1::bigint[])
      RETURNING id, payment_id, financial_code_uuid
    `, duplicateIds);
    
    console.log(`\n✅ Deleted ${result.length} duplicate payments:`);
    result.forEach(p => {
      console.log(`   - ID ${p.id}: ${p.payment_id}`);
    });
    
    // Verify cleanup
    const remaining = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM payments 
      WHERE project_uuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f'
    `, );
    
    console.log(`\n✅ Remaining payments for project: ${remaining[0].count}`);
    
    // Check for any remaining duplicates
    const check = await prisma.$queryRawUnsafe(`
      SELECT 
        financial_code_uuid,
        counteragent_uuid,
        job_uuid,
        income_tax,
        currency_uuid,
        COUNT(*) as count
      FROM payments 
      WHERE project_uuid = 'f67cc96b-365f-4a30-9819-a3ee7ad41b1f'
      GROUP BY financial_code_uuid, counteragent_uuid, job_uuid, income_tax, currency_uuid
      HAVING COUNT(*) > 1
    `);
    
    if (check.length > 0) {
      console.log('\n⚠️  WARNING: Still have duplicates!');
      console.log(check);
    } else {
      console.log('\n✅ No duplicates remaining!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteDuplicates();
