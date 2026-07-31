const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function directFixBogGel() {
  console.log('=== DIRECT SQL UPDATE FOR BOG_GEL ===\n');
  
  const table = 'GE78BG0000000893486000_BOG_GEL';
  
  console.log('Executing direct UPDATE statement...');
  console.log('This updates all transactions where payment exists with project_uuid...\n');
  
  try {
    // Simple direct UPDATE - bypass the DISTINCT issue
    const result = await prisma.$queryRawUnsafe(`
      UPDATE "${table}" t
      SET project_uuid = p.project_uuid,
          financial_code_uuid = p.financial_code_uuid
      FROM payments p
      WHERE t.payment_id = p.payment_id
        AND t.project_uuid IS NULL
        AND p.project_uuid IS NOT NULL
    `);
    
    console.log('✓ Update statement executed successfully\n');
    
    // Check how many remain
    const remaining = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt
      FROM "${table}" t
      WHERE project_uuid IS NULL
        AND payment_id IN (
          SELECT payment_id FROM payments WHERE project_uuid IS NOT NULL
        )
    `);
    
    console.log(`Remaining issues in ${table}: ${remaining[0].cnt}`);
    
    if (remaining[0].cnt === 0) {
      console.log('✅ All fixed!');
    }
    
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
  
  await prisma.$disconnect();
}

directFixBogGel().catch(console.error);
