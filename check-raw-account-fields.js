const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkColumns() {
  try {
    const cols = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bog_gel_raw_893486000' 
      AND column_name LIKE '%acct%'
      ORDER BY column_name
    `;
    
    console.log('Columns with "acct":', cols.map(c => c.column_name));
    
    // Check if data exists
    const sampleWithSender = await prisma.$queryRaw`
      SELECT docsenderacctno, docbenefacctno, entrydbamt
      FROM bog_gel_raw_893486000
      WHERE docsenderacctno IS NOT NULL
      LIMIT 5
    `;
    
    console.log('\nSample with docsenderacctno:', sampleWithSender);
    
    const sampleWithBenef = await prisma.$queryRaw`
      SELECT docsenderacctno, docbenefacctno, entrydbamt
      FROM bog_gel_raw_893486000
      WHERE docbenefacctno IS NOT NULL
      LIMIT 5
    `;
    
    console.log('\nSample with docbenefacctno:', sampleWithBenef);
    
    // Count records with account numbers
    const counts = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(docsenderacctno) as sender_count,
        COUNT(docbenefacctno) as benef_count,
        COUNT(CASE WHEN docsenderacctno IS NOT NULL OR docbenefacctno IS NOT NULL THEN 1 END) as either_count
      FROM bog_gel_raw_893486000
    `;
    
    console.log('\nAccount number counts:', {
      total: Number(counts[0].total),
      sender_count: Number(counts[0].sender_count),
      benef_count: Number(counts[0].benef_count),
      either_count: Number(counts[0].either_count)
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
