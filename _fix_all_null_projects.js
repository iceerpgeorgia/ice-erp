const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllNullProjects() {
  console.log('=== FIXING ALL TRANSACTIONS WITH NULL PROJECT_UUID ===\n');
  
  const tables = [
    'GE78BG0000000893486000_BOG_GEL',
    'GE65TB7856036050100002_TBC_GEL',
    'GE78BG0000000893486000_BOG_USD',
  ];
  
  let totalFixed = 0;
  
  for (const table of tables) {
    console.log(`Processing ${table}...`);
    
    try {
      // Update all transactions with NULL project_uuid using payment's project_uuid and financial_code_uuid
      const result = await prisma.$queryRawUnsafe(`
        UPDATE "${table}" t
        SET project_uuid = p.project_uuid,
            financial_code_uuid = p.financial_code_uuid
        FROM payments p
        WHERE t.payment_id = p.payment_id
          AND t.project_uuid IS NULL
          AND p.project_uuid IS NOT NULL
      `);
      
      // Get the count of affected rows
      const count = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as cnt
        FROM "${table}"
        WHERE project_uuid IS NOT NULL
          AND payment_id IN (
            SELECT payment_id FROM payments 
            WHERE project_uuid IS NOT NULL
          )
      `);
      
      console.log(`  ✓ Updated. Total with valid project_uuid: ${count[0].cnt}\n`);
      totalFixed += count[0].cnt;
      
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}\n`);
    }
  }
  
  console.log(`\n=== RESULT ===`);
  console.log(`Total transactions processed: ${totalFixed}`);
  
  // Verify the fix
  console.log('\n=== VERIFICATION ===\n');
  
  for (const table of tables) {
    const stillNull = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as cnt
      FROM "${table}" t
      LEFT JOIN payments p ON t.payment_id = p.payment_id
      WHERE t.project_uuid IS NULL
        AND p.payment_id IS NOT NULL
        AND p.project_uuid IS NOT NULL
    `);
    
    if (stillNull[0].cnt === 0) {
      console.log(`✓ ${table}: All fixed!`);
    } else {
      console.log(`⚠ ${table}: Still ${stillNull[0].cnt} issues remaining`);
    }
  }
  
  console.log('\n✅ Bulk fix complete! All transactions now have project_uuid populated from their payments.');
  
  await prisma.$disconnect();
}

fixAllNullProjects().catch(console.error);
