const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixBogGelInBatches() {
  console.log('=== FIXING BOG_GEL IN BATCHES (QUERY TIMEOUT WORKAROUND) ===\n');
  
  const table = 'GE78BG0000000893486000_BOG_GEL';
  let batchSize = 1000;
  let offset = 0;
  let totalFixed = 0;
  
  while (true) {
    console.log(`Processing batch: offset=${offset}, size=${batchSize}...`);
    
    try {
      // Get payment_ids that need fixing in this batch
      const batch = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT t.payment_id
        FROM "${table}" t
        LEFT JOIN payments p ON t.payment_id = p.payment_id
        WHERE t.project_uuid IS NULL
          AND p.payment_id IS NOT NULL
          AND p.project_uuid IS NOT NULL
        LIMIT $1 OFFSET $2
      `, batchSize, offset);
      
      if (batch.length === 0) {
        console.log(`  ✓ All batches processed!\n`);
        break;
      }
      
      // Extract payment IDs
      const paymentIds = batch.map(b => b.payment_id);
      
      // Build IN clause
      const placeholders = paymentIds.map((_, i) => `$${i + 1}`).join(',');
      
      // Update this batch
      const result = await prisma.$queryRawUnsafe(
        `
          UPDATE "${table}" t
          SET project_uuid = p.project_uuid,
              financial_code_uuid = p.financial_code_uuid
          FROM payments p
          WHERE t.payment_id = p.payment_id
            AND t.project_uuid IS NULL
            AND t.payment_id IN (${placeholders})
          RETURNING t.uuid
        `,
        ...paymentIds
      );
      
      totalFixed += result.length;
      console.log(`  ✓ Fixed ${result.length} transactions`);
      
      // Move to next batch
      offset += batchSize;
      
      // Add small delay between batches
      await new Promise(r => setTimeout(r, 100));
      
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      // Try smaller batch
      if (batchSize > 100) {
        console.log(`  Retrying with smaller batch size...\n`);
        batchSize = Math.floor(batchSize / 2);
      } else {
        break;
      }
    }
  }
  
  console.log(`\n=== TOTAL FIXED: ${totalFixed} ===\n`);
  
  // Final verification
  console.log('=== FINAL VERIFICATION ===\n');
  const stillNull = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt
    FROM "${table}" t
    LEFT JOIN payments p ON t.payment_id = p.payment_id
    WHERE t.project_uuid IS NULL
      AND p.payment_id IS NOT NULL
      AND p.project_uuid IS NOT NULL
  `);
  
  console.log(`Remaining issues in ${table}: ${stillNull[0].cnt}`);
  
  if (stillNull[0].cnt === 0) {
    console.log('✅ All fixed!');
  }
  
  await prisma.$disconnect();
}

fixBogGelInBatches().catch(console.error);
