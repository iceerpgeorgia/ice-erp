import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFinancialCodes() {
  console.log('🧪 Testing Financial Codes API...\n');

  // Test 1: Count all codes
  console.log('Test 1: Count all codes');
  const totalCount = await prisma.financialCode.count();
  console.log(`   Total codes: ${totalCount}`);

  // Test 2: Count by type
  console.log('\nTest 2: Count by type');
  const types = await prisma.financialCode.groupBy({
    by: ['nodeType'],
    _count: true,
  });
  types.forEach(t => {
    console.log(`   ${t.nodeType}: ${t._count}`);
  });

  // Test 3: Get a specific code
  console.log('\nTest 3: Get specific code (1.1.1.1)');
  const specificCode = await prisma.financialCode.findFirst({
    where: { code: '1.1.1.1' },
  });
  if (specificCode) {
    console.log(`   Found: ${specificCode.code} - ${specificCode.name}`);
    console.log(`   Type: ${specificCode.nodeType}`);
    console.log(`   P&L: ${specificCode.appliesToPL}, CF: ${specificCode.appliesToCF}`);
  } else {
    console.log('   Code not found');
  }

  // Test 4: Get all level 1 codes
  console.log('\nTest 4: Get all level 1 codes (root nodes)');
  const rootCodes = await prisma.financialCode.findMany({
    where: {
      depth: 1,
      isFormula: false,
    },
    orderBy: { level1: 'asc' },
  });
  console.log(`   Found ${rootCodes.length} root codes:`);
  rootCodes.slice(0, 5).forEach(code => {
    console.log(`   • ${code.code} - ${code.name}`);
  });
  if (rootCodes.length > 5) {
    console.log(`   ... and ${rootCodes.length - 5} more`);
  }

  // Test 5: Test closure table
  console.log('\nTest 5: Test closure table');
  const pathCount = await prisma.financialCodePath.count();
  console.log(`   Total paths: ${pathCount}`);

  // Get descendants of first root code
  if (rootCodes.length > 0) {
    const firstRoot = rootCodes[0];
    const descendants = await prisma.financialCodePath.findMany({
      where: {
        ancestorId: firstRoot.id,
        depth: { gt: 0 }, // Exclude self
      },
      include: {
        descendant: true,
      },
      take: 5,
    });
    
    console.log(`   Descendants of ${firstRoot.code}:`);
    descendants.forEach(path => {
      console.log(`   • ${path.descendant.code} - ${path.descendant.name} (depth: ${path.depth})`);
    });
  }

  // Test 6: Count addable rows (transaction targets)
  console.log('\nTest 6: Transaction-ready codes');
  const addableCount = await prisma.financialCode.count({
    where: { nodeType: 'Addable row' },
  });
  console.log(`   Addable rows: ${addableCount}`);

  // Test 7: P&L vs CF codes
  console.log('\nTest 7: Statement applicability');
  const plCount = await prisma.financialCode.count({
    where: { appliesToPL: true, isFormula: false },
  });
  const cfCount = await prisma.financialCode.count({
    where: { appliesToCF: true, isFormula: false },
  });
  const bothCount = await prisma.financialCode.count({
    where: { appliesToPL: true, appliesToCF: true, isFormula: false },
  });
  console.log(`   P&L codes: ${plCount}`);
  console.log(`   Cash Flow codes: ${cfCount}`);
  console.log(`   Both: ${bothCount}`);

  console.log('\n✅ All tests completed!');
}

testFinancialCodes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
