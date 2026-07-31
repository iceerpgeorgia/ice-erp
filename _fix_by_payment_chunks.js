const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixByPaymentChunks() {
  console.log('=== FIXING BOG_GEL BY PAYMENT_ID CHUNKS ===\n');
  
  const table = 'GE78BG0000000893486000_BOG_GEL';
  
  // Get list of unique payment_ids that need fixing
  console.log('Step 1: Getting list of payment IDs to fix...');
  const paymentIds = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT t.payment_id
    FROM "${table}" t
    LEFT JOIN payments p ON t.payment_id = p.payment_id
    WHERE t.project_uuid IS NULL
      AND p.payment_id IS NOT NULL
      AND p.project_uuid IS NOT NULL
    ORDER BY t.payment_id
  `);
  
  console.log(`Found ${paymentIds.length} unique payment IDs to fix\n`);
  
  let totalFixed = 0;
  const chunkSize = 10; // Process 10 payment IDs at a time
  
  for (let i = 0; i < paymentIds.length; i += chunkSize) {
    const chunk = paymentIds.slice(i, i + chunkSize);
    const paymentIdList = chunk.map(p => p.payment_id);
    
    console.log(`Processing payment IDs ${i + 1}-${Math.min(i + chunkSize, paymentIds.length)} of ${paymentIds.length}...`);
    
    try {
      // Update transactions for these payment IDs
      const result = await prisma.$queryRawUnsafe(`
        UPDATE "${table}" t
        SET project_uuid = p.project_uuid,
            financial_code_uuid = p.financial_code_uuid
        FROM payments p
        WHERE t.payment_id = p.payment_id
          AND t.project_uuid IS NULL
          AND t.payment_id = ANY($1)
      `, paymentIdList);
      
      console.log(`  ✓ Updated\n`);
      totalFixed += chunk.length;
      
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}\n`);
    }
  }
  
  console.log(`\n=== RESULT ===`);
  console.log(`Processed: ${totalFixed} payment IDs`);
  
  // Check remaining
  const remaining = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as cnt
    FROM "${table}" t
    WHERE project_uuid IS NULL
      AND payment_id IN (
        SELECT payment_id FROM payments WHERE project_uuid IS NOT NULL
      )
  `);
  
  console.log(`Remaining issues: ${remaining[0].cnt}`);
  
  if (remaining[0].cnt === 0) {
    console.log('✅ All fixed!');
  }
  
  await prisma.$disconnect();
}

fixByPaymentChunks().catch(console.error);
